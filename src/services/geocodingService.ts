import { MADRID_BARANGAYS, MADRID_CENTER, calculateDistanceKm } from '../constants/madridLocations';

export interface IdentifiedAddress {
  fullAddress: string;
  streetAddress: string;
  barangay: string;
  municipality: string;
  province: string;
  postalCode: string;
  nearestLandmark: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isGeocodedOnline: boolean;
}

// Key localized landmarks in Madrid, Surigao del Sur with coordinates
const MADRID_LANDMARKS = [
  { name: 'Madrid Municipal Hall Complex', lat: 9.2615, lng: 125.9618, barangay: 'Linungao (Poblacion)' },
  { name: 'BFP Madrid Fire Station', lat: 9.2628, lng: 125.9602, barangay: 'Linungao (Poblacion)' },
  { name: 'Madrid Municipal Public Market', lat: 9.2632, lng: 125.9622, barangay: 'Linungao (Poblacion)' },
  { name: 'Linungao Port & Ferry Pier', lat: 9.2645, lng: 125.9635, barangay: 'Linungao (Poblacion)' },
  { name: 'Madrid District Hospital / RHU', lat: 9.2605, lng: 125.9595, barangay: 'Linungao (Poblacion)' },
  { name: 'Songkit National Highway Curve', lat: 9.2730, lng: 125.9550, barangay: 'Songkit' },
  { name: 'Songkit Coastal Beachline', lat: 9.2745, lng: 125.9575, barangay: 'Songkit' },
  { name: 'Bayogo Agricultural Crossing', lat: 9.2480, lng: 125.9680, barangay: 'Bayogo' },
  { name: 'San Antonio River Bridge', lat: 9.2550, lng: 125.9520, barangay: 'San Antonio' },
  { name: 'Union Elementary School', lat: 9.2820, lng: 125.9490, barangay: 'Union' },
  { name: 'Patong Coastal Fish Landing', lat: 9.2390, lng: 125.9750, barangay: 'Patong' },
  { name: 'San Vicente Highway Junction', lat: 9.2510, lng: 125.9610, barangay: 'San Vicente' },
  { name: 'Quirino Northern Boundary Gate', lat: 9.2900, lng: 125.9420, barangay: 'Quirino' },
];

/**
 * Find the closest known barangay in Madrid
 */
export function getNearestBarangay(lat: number, lng: number): { name: string; distanceKm: number } {
  let closest = MADRID_BARANGAYS[0];
  let minDistance = calculateDistanceKm(lat, lng, closest.lat, closest.lng);

  for (const b of MADRID_BARANGAYS) {
    const dist = calculateDistanceKm(lat, lng, b.lat, b.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = b;
    }
  }

  return { name: closest.name, distanceKm: minDistance };
}

/**
 * Find the closest landmark in Madrid
 */
export function getNearestLandmark(lat: number, lng: number): { name: string; distanceKm: number; barangay: string } {
  let closest = MADRID_LANDMARKS[0];
  let minDistance = calculateDistanceKm(lat, lng, closest.lat, closest.lng);

  for (const lm of MADRID_LANDMARKS) {
    const dist = calculateDistanceKm(lat, lng, lm.lat, lm.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = lm;
    }
  }

  return { name: closest.name, distanceKm: minDistance, barangay: closest.barangay };
}

/**
 * Automatically reverse geocode coordinates into a structured, full address.
 * Tries online reverse geocoding (OpenStreetMap Nominatim) and falls back
 * gracefully to localized Madrid Barangay & landmark mapping.
 */
export async function identifyAddressFromCoords(
  lat: number = MADRID_CENTER.latitude,
  lng: number = MADRID_CENTER.longitude,
  accuracyMeters: number = 8
): Promise<IdentifiedAddress> {
  const nearestBgy = getNearestBarangay(lat, lng);
  const nearestLm = getNearestLandmark(lat, lng);

  // Fallback localized address computation
  const fallbackStreet = `${nearestLm.distanceKm < 0.35 ? `Near ${nearestLm.name}` : `Purok ${Math.floor((lat * 100) % 5) + 1}`}, National Highway`;
  const fallbackFullAddress = `${fallbackStreet}, Brgy. ${nearestBgy.name}, Madrid, Surigao del Sur, 8316`;

  // Try online reverse geocoding if network is available
  if (navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const road = address.road || address.pedestrian || address.neighbourhood || fallbackStreet;
        const village = address.village || address.suburb || nearestBgy.name;
        const town = address.town || address.city || address.municipality || 'Madrid';
        const state = address.state || 'Surigao del Sur';
        const postcode = address.postcode || '8316';

        const formattedStreet = `${road}`;
        const formattedFull = `${formattedStreet}, Brgy. ${village}, ${town}, ${state}, ${postcode}`;

        return {
          fullAddress: data.display_name ? formattedFull : fallbackFullAddress,
          streetAddress: formattedStreet,
          barangay: village,
          municipality: town,
          province: state,
          postalCode: postcode,
          nearestLandmark: nearestLm.name,
          latitude: lat,
          longitude: lng,
          accuracyMeters,
          isGeocodedOnline: true,
        };
      }
    } catch {
      // Ignore network timeout or CORS, proceed to offline fallback
    }
  }

  return {
    fullAddress: fallbackFullAddress,
    streetAddress: fallbackStreet,
    barangay: nearestBgy.name,
    municipality: 'Madrid',
    province: 'Surigao del Sur',
    postalCode: '8316',
    nearestLandmark: nearestLm.name,
    latitude: lat,
    longitude: lng,
    accuracyMeters,
    isGeocodedOnline: false,
  };
}
