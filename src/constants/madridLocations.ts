import { ResponderUnit } from '../types';

// Madrid, Surigao del Sur, Caraga Region (Region XIII), Mindanao, Philippines
export const MADRID_CENTER = {
  latitude: 9.2611,
  longitude: 125.9614,
  zoom: 14,
};

export interface MadridBarangay {
  name: string;
  lat: number;
  lng: number;
  riskProfile: string;
  populationEstimate: number;
}

export const MADRID_BARANGAYS: MadridBarangay[] = [
  { name: 'Linungao (Poblacion)', lat: 9.2618, lng: 125.9610, riskProfile: 'Commercial, High Density & Port Area', populationEstimate: 2900 },
  { name: 'Songkit', lat: 9.2730, lng: 125.9550, riskProfile: 'Coastal & Highway Corridor', populationEstimate: 1650 },
  { name: 'Bayogo', lat: 9.2480, lng: 125.9680, riskProfile: 'Residential & Agricultural', populationEstimate: 1820 },
  { name: 'Union', lat: 9.2820, lng: 125.9490, riskProfile: 'Farmland & Rural Settlement', populationEstimate: 1400 },
  { name: 'San Antonio', lat: 9.2550, lng: 125.9520, riskProfile: 'River Basin & Residential', populationEstimate: 1980 },
  { name: 'Quirino', lat: 9.2900, lng: 125.9420, riskProfile: 'Northern Highway Gateway', populationEstimate: 1150 },
  { name: 'Patong', lat: 9.2390, lng: 125.9750, riskProfile: 'Coastal Fishing Community', populationEstimate: 1280 },
  { name: 'Manga', lat: 9.2680, lng: 125.9410, riskProfile: 'Upland Agricultural Foothills', populationEstimate: 950 },
  { name: 'Bagsac', lat: 9.2450, lng: 125.9320, riskProfile: 'Hilly Interior / Low Signal Zone', populationEstimate: 870 },
  { name: 'Magsaysay', lat: 9.2750, lng: 125.9380, riskProfile: 'Plantation & Foothill Trails', populationEstimate: 1020 },
  { name: 'Panayagon', lat: 9.2840, lng: 125.9280, riskProfile: 'Interior Agricultural Sector', populationEstimate: 780 },
  { name: 'San Roque', lat: 9.2580, lng: 125.9720, riskProfile: 'Coastal Road Zone', populationEstimate: 1340 },
  { name: 'San Vicente', lat: 9.2510, lng: 125.9610, riskProfile: 'Highway Intersection', populationEstimate: 1510 },
  { name: 'Tuburan', lat: 9.2310, lng: 125.9810, riskProfile: 'Southern Coastal Boundary', populationEstimate: 890 },
];

export interface EmergencyStation {
  id: string;
  name: string;
  category: 'fire' | 'medical' | 'police' | 'rescue';
  lat: number;
  lng: number;
  address: string;
  hotline: string;
  smsNumber: string;
  description: string;
}

export const MADRID_EMERGENCY_STATIONS: EmergencyStation[] = [
  {
    id: 'bfp-madrid',
    name: 'BFP Madrid Municipal Fire Station',
    category: 'fire',
    lat: 9.2628,
    lng: 125.9602,
    address: 'National Highway, Brgy. Linungao, Madrid, Surigao del Sur',
    hotline: '0931-7218-765',
    smsNumber: '09317218765',
    description: 'Bureau of Fire Protection - Primary 1st Response Fire & Rescue Unit',
  },
  {
    id: 'mdrrmo-madrid',
    name: 'MDRRMO Madrid Emergency Operations Center',
    category: 'rescue',
    lat: 9.2615,
    lng: 125.9618,
    address: 'Municipal Hall Complex, Madrid, Surigao del Sur',
    hotline: '0998-552-1911',
    smsNumber: '09985521911',
    description: 'Municipal Disaster Risk Reduction & Management Office Command Post',
  },
  {
    id: 'mdh-madrid',
    name: 'Madrid District Hospital (MDH)',
    category: 'medical',
    lat: 9.2642,
    lng: 125.9592,
    address: 'Brgy. Linungao, Madrid, Surigao del Sur',
    hotline: '(086) 211-3000 / 0928-441-9201',
    smsNumber: '09284419201',
    description: 'Level 1 Provincial District Hospital with 24/7 Emergency Room & Trauma Center',
  },
  {
    id: 'pnp-madrid',
    name: 'Madrid Municipal Police Station (MPS)',
    category: 'police',
    lat: 9.2608,
    lng: 125.9625,
    address: 'Poblacion, Madrid, Surigao del Sur',
    hotline: '0998-598-7329',
    smsNumber: '09985987329',
    description: 'Philippine National Police - Traffic Accident & Public Safety Response',
  },
];

export const INITIAL_RESPONDER_UNITS: ResponderUnit[] = [
  {
    id: 'unit-bfp-01',
    name: 'BFP Engine 01 (Rosenbauer Pumper)',
    callSign: 'MADRID-FIRE-1',
    type: 'fire_engine',
    stationName: 'BFP Madrid Fire Station',
    currentLat: 9.2628,
    currentLng: 125.9602,
    status: 'available',
    driverName: 'FO2 Rommel Plaza, BFP',
    contactNumber: '0931-7218-765',
  },
  {
    id: 'unit-bfp-amb-01',
    name: 'BFP Madrid EMS Ambulance Alpha',
    callSign: 'BFP-EMS-AMB-1',
    type: 'ambulance',
    stationName: 'BFP Madrid Fire Station',
    currentLat: 9.2628,
    currentLng: 125.9602,
    status: 'available',
    driverName: 'FO1 Mark Arreza, BFP-EMS',
    contactNumber: '0931-7218-765',
  },
  {
    id: 'unit-rescue-01',
    name: 'MDRRMO Alpha Rescue Ambulance',
    callSign: 'RESCUE-ALPHA-1',
    type: 'ambulance',
    stationName: 'Madrid MDRRMO Command Post',
    currentLat: 9.2615,
    currentLng: 125.9618,
    status: 'available',
    driverName: 'EMT Christian Dalisay',
    contactNumber: '0998-552-1911',
  },
  {
    id: 'unit-pnp-01',
    name: 'Madrid PNP Patrol Unit 04',
    callSign: 'PATROL-4',
    type: 'patrol',
    stationName: 'Madrid Police Station',
    currentLat: 9.2608,
    currentLng: 125.9625,
    status: 'available',
    driverName: 'PSSg Mark Guingona',
    contactNumber: '0998-598-7329',
  },
];

// Calculation of straight line distance (Haversine formula) in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Estimated road travel time in minutes assuming 40 km/h emergency vehicle speed in local Madrid terrain
export function estimateEmergencyEta(distanceKm: number): number {
  const avgSpeedKmH = 38; // municipal roads and highway mix
  const hours = distanceKm / avgSpeedKmH;
  const minutes = Math.max(1, Math.round(hours * 60) + 1); // min 1-2 min rollout time
  return minutes;
}
