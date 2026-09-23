import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { IncidentReport, ResponderUnit } from '../../types';
import { MADRID_CENTER, MADRID_BARANGAYS, MADRID_EMERGENCY_STATIONS, calculateDistanceKm, estimateEmergencyEta } from '../../constants/madridLocations';
import { Flame, Car, HeartPulse, ShieldAlert, Navigation, Layers, Compass } from 'lucide-react';

interface LeafletEmergencyMapProps {
  reports: IncidentReport[];
  selectedReportId?: string | null;
  onSelectReport: (report: IncidentReport) => void;
  responderUnits: ResponderUnit[];
  isNightMode: boolean;
  userCoords?: { lat: number; lng: number } | null;
  onMapClickPinpoint?: (coords: { lat: number; lng: number }) => void;
  isPinpointingMode?: boolean;
}

export default function LeafletEmergencyMap({
  reports,
  selectedReportId,
  onSelectReport,
  responderUnits,
  isNightMode,
  userCoords,
  onMapClickPinpoint,
  isPinpointingMode = false,
}: LeafletEmergencyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'street'>('dark');
  const [activeStationInfo, setActiveStationInfo] = useState<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [MADRID_CENTER.latitude, MADRID_CENTER.longitude],
      zoom: MADRID_CENTER.zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom dark / high contrast tile layer
    const tileUrl = isNightMode || mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : mapStyle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const baseTile = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base tiles on style or night mode switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (!isNightMode && mapStyle === 'street') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    } else if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
  }, [isNightMode, mapStyle]);

  // Handle map click for pinpointing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPinpointingMode && onMapClickPinpoint) {
        onMapClickPinpoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPinpointingMode, onMapClickPinpoint]);

  // Render markers and routing
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Render Madrid Emergency Stations (BFP, MDRRMO, MDH, PNP)
    MADRID_EMERGENCY_STATIONS.forEach((station) => {
      const isBfp = station.category === 'fire';
      const isMdh = station.category === 'medical';
      const isRescue = station.category === 'rescue';

      const iconBg = isBfp ? 'bg-amber-600' : isMdh ? 'bg-emerald-600' : isRescue ? 'bg-sky-600' : 'bg-indigo-600';
      const iconLabel = isBfp ? '🔥 BFP' : isMdh ? '🏥 MDH' : isRescue ? '🚨 MDRRMO' : '👮 PNP';

      const stationIcon = L.divIcon({
        className: 'custom-station-icon',
        html: `
          <div class="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
            <div class="${iconBg} text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-white/40 flex items-center gap-1">
              <span>${iconLabel}</span>
            </div>
            <div class="absolute -bottom-1 w-1.5 h-1.5 ${iconBg} rotate-45"></div>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 24],
      });

      const stationMarker = L.marker([station.lat, station.lng], { icon: stationIcon });
      stationMarker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans min-w-[200px]">
          <div class="text-xs uppercase font-extrabold text-slate-500">${station.category.toUpperCase()} HEADQUARTERS</div>
          <div class="text-sm font-bold text-slate-900">${station.name}</div>
          <div class="text-xs text-slate-600 mt-0.5">${station.address}</div>
          <div class="text-xs font-semibold text-rose-600 mt-1.5 flex items-center gap-1">
            📞 Hotline: ${station.hotline}
          </div>
        </div>
      `);
      stationMarker.addTo(markersLayer);
    });

    // 2. Render Barangay Labels for Madrid
    MADRID_BARANGAYS.forEach((brgy) => {
      const brgyIcon = L.divIcon({
        className: 'brgy-label',
        html: `
          <div class="text-[9px] uppercase tracking-wider font-semibold text-slate-400/80 bg-slate-950/60 px-1.5 py-0.5 rounded backdrop-blur-[2px] border border-slate-700/40 pointer-events-none whitespace-nowrap">
            ${brgy.name}
          </div>
        `,
        iconSize: [80, 16],
        iconAnchor: [40, 8],
      });
      L.marker([brgy.lat, brgy.lng], { icon: brgyIcon, interactive: false }).addTo(markersLayer);
    });

    // 3. Render User Location if available
    if (userCoords) {
      const userIcon = L.divIcon({
        className: 'user-loc-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-cyan-500/30 animate-ping"></span>
            <span class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-md"></span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .bindTooltip('Your Location', { permanent: false, direction: 'top' })
        .addTo(markersLayer);
    }

    // 4. Render Active Incident Markers
    reports.forEach((report) => {
      const isSelected = report.id === selectedReportId;
      const isUnidentified = report.category === 'unidentified' || report.isIdentified === false;
      const isFire = report.category === 'fire';
      const isVehicular = report.category === 'vehicular';
      const isMedical = report.category === 'medical';

      const colorClass = isUnidentified
        ? 'bg-fuchsia-600 text-white shadow-fuchsia-900/60 ring-2 ring-fuchsia-400'
        : isFire
        ? 'bg-rose-600 text-white shadow-rose-900/60'
        : isVehicular
        ? 'bg-amber-500 text-white shadow-amber-900/60'
        : 'bg-emerald-600 text-white shadow-emerald-900/60';

      const pulseRingClass = isUnidentified
        ? 'border-fuchsia-500 bg-fuchsia-500/25'
        : isFire
        ? 'border-rose-500 bg-rose-500/20'
        : isVehicular
        ? 'border-amber-400 bg-amber-400/20'
        : 'border-emerald-500 bg-emerald-500/20';

      const iconEmoji = isUnidentified ? '📸' : isFire ? '🔥' : isVehicular ? '🚗' : '🚑';

      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'} transition-transform">
          ${report.status !== 'resolved' ? `<div class="absolute -inset-3 rounded-full border-2 ${pulseRingClass} animate-ping pointer-events-none"></div>` : ''}
          <div class="relative w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shadow-lg border-2 border-white text-sm font-bold">
            ${iconEmoji}
          </div>
          <div class="absolute -bottom-1.5 w-2 h-2 ${colorClass.split(' ')[0]} rotate-45"></div>
          ${isSelected ? `
            <div class="absolute -top-7 px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold rounded shadow-lg whitespace-nowrap border border-slate-700">
              ${report.incidentNumber} ${isUnidentified ? '• PHOTO AWAITING ADMIN' : ''}
            </div>
          ` : ''}
        </div>
      `;

      const incidentIcon = L.divIcon({
        className: 'custom-incident-marker',
        html: markerHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 30],
      });

      const incidentMarker = L.marker([report.location.latitude, report.location.longitude], {
        icon: incidentIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      incidentMarker.on('click', () => {
        onSelectReport(report);
      });

      incidentMarker.addTo(markersLayer);
    });

    // 5. Draw Routing for Selected Incident
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    const selectedReport = reports.find((r) => r.id === selectedReportId);
    if (selectedReport) {
      // Find origin station (BFP Madrid for fire, MDRRMO for rescue/vehicular, MDH for medical)
      let originLat = 9.2628;
      let originLng = 125.9602;
      let stationName = 'BFP Madrid Fire Station';

      if (selectedReport.category === 'fire') {
        const bfp = MADRID_EMERGENCY_STATIONS.find(s => s.id === 'bfp-madrid')!;
        originLat = bfp.lat;
        originLng = bfp.lng;
        stationName = bfp.name;
      } else if (selectedReport.category === 'medical') {
        const mdh = MADRID_EMERGENCY_STATIONS.find(s => s.id === 'mdh-madrid')!;
        originLat = mdh.lat;
        originLng = mdh.lng;
        stationName = mdh.name;
      } else {
        const mdrrmo = MADRID_EMERGENCY_STATIONS.find(s => s.id === 'mdrrmo-madrid')!;
        originLat = mdrrmo.lat;
        originLng = mdrrmo.lng;
        stationName = mdrrmo.name;
      }

      const destLat = selectedReport.location.latitude;
      const destLng = selectedReport.location.longitude;

      // Realistic waypoints along Madrid National Highway & barangay access road
      const midLat = (originLat + destLat) / 2 + (Math.sin(destLat) * 0.0005);
      const midLng = (originLng + destLng) / 2 + (Math.cos(destLng) * 0.0005);

      const routePoints: L.LatLngExpression[] = [
        [originLat, originLng],
        [midLat, midLng],
        [destLat, destLng],
      ];

      // Draw route line
      const routeLine = L.polyline(routePoints, {
        color: selectedReport.category === 'fire' ? '#ef4444' : selectedReport.category === 'vehicular' ? '#f59e0b' : '#10b981',
        weight: 4,
        opacity: 0.9,
        dashArray: selectedReport.status === 'en_route' ? '8, 8' : undefined,
      }).addTo(markersLayer);

      routePolylineRef.current = routeLine;

      // Add animated vehicle marker along route if dispatched or en route
      if (selectedReport.status === 'en_route' || selectedReport.status === 'dispatched') {
        const vehiclePosLat = selectedReport.status === 'en_route' ? midLat : originLat;
        const vehiclePosLng = selectedReport.status === 'en_route' ? midLng : originLng;

        const vehicleIcon = L.divIcon({
          className: 'custom-vehicle-marker',
          html: `
            <div class="relative flex items-center justify-center p-1.5 rounded-full bg-slate-900 border-2 border-amber-400 shadow-xl text-amber-400 animate-bounce">
              <span class="text-xs font-bold font-mono">🚨 EN ROUTE</span>
            </div>
          `,
          iconSize: [84, 28],
          iconAnchor: [42, 14],
        });

        L.marker([vehiclePosLat, vehiclePosLng], { icon: vehicleIcon, zIndexOffset: 1200 }).addTo(markersLayer);
      }
    }
  }, [reports, selectedReportId, responderUnits, isNightMode, userCoords]);

  // Recenter map helper
  const recenterMadrid = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([MADRID_CENTER.latitude, MADRID_CENTER.longitude], MADRID_CENTER.zoom, { animate: true });
    }
  };

  const focusUser = () => {
    if (mapInstanceRef.current && userCoords) {
      mapInstanceRef.current.setView([userCoords.lat, userCoords.lng], 16, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full bg-slate-950" />

      {/* Floating Tactical Map Controls */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-xl flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setMapStyle('dark')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              mapStyle === 'dark' ? 'bg-rose-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tactical Dark
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              mapStyle === 'satellite' ? 'bg-rose-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapStyle('street')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              mapStyle === 'street' ? 'bg-rose-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Day Street
          </button>
        </div>

        {/* Pinpoint Mode Alert */}
        {isPinpointingMode && (
          <div className="bg-amber-500/95 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-pulse">
            <Compass className="w-4 h-4" />
            <span>Tap anywhere on the Madrid map to set emergency pin</span>
          </div>
        )}
      </div>

      {/* Navigation Quick Actions */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button
          onClick={recenterMadrid}
          className="bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-slate-200 border border-slate-700/80 p-2.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md"
          title="Recenter Madrid Municipal Center"
        >
          <Navigation className="w-4 h-4 text-rose-500" />
          <span className="hidden sm:inline">Madrid Center</span>
        </button>

        {userCoords && (
          <button
            onClick={focusUser}
            className="bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-slate-200 border border-slate-700/80 p-2.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md"
            title="My GPS Location"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="hidden sm:inline">My GPS</span>
          </button>
        )}
      </div>

      {/* Responder Legend / Status Bar at Bottom */}
      <div className="absolute bottom-4 left-3 right-3 md:right-auto md:w-96 z-[400] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-bold text-slate-200 text-xs tracking-wide">MADRID LIVE DISPATCH GRID</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">SURIGAO DEL SUR</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
            <div className="text-[10px] text-rose-400 font-bold flex items-center justify-center gap-1">
              <Flame className="w-3 h-3" /> BFP Madrid
            </div>
            <div className="text-slate-300 font-semibold text-[11px] mt-0.5">1 Engine Ready</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
            <div className="text-[10px] text-sky-400 font-bold flex items-center justify-center gap-1">
              <Car className="w-3 h-3" /> MDRRMO
            </div>
            <div className="text-slate-300 font-semibold text-[11px] mt-0.5">Ambulance Alpha</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
            <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
              <HeartPulse className="w-3 h-3" /> MDH ER
            </div>
            <div className="text-slate-300 font-semibold text-[11px] mt-0.5">Level 1 Trauma</div>
          </div>
        </div>
      </div>
    </div>
  );
}
