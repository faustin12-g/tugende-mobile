import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type * as GeoJSON from 'geojson';
import type { PlaceSelection } from '../../services/googlePlaces';

const KIGALI_CENTER: [number, number] = [29.8739, -1.9403];
const DEFAULT_ZOOM = 14;
const RADAR_SOURCE_ID = 'pickup-radar-source';
const RADAR_FILL_LAYER_ID = 'pickup-radar-fill';
const RADAR_LINE_LAYER_ID = 'pickup-radar-line';
const RADAR_WAVE_COUNT = 3;
const RADAR_DURATION_MS = 4500;
const RADAR_MAX_RADIUS_METERS = 1400;
const RADAR_RING_SEGMENTS = 48;
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN?.trim();
const hasMapboxToken = Boolean(mapboxToken?.startsWith('pk.'));

if (hasMapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  showUserLocation?: boolean;
  interactive?: boolean;
  onMapReady?: (map: mapboxgl.Map) => void;
  onLocationFound?: (coords: { lat: number; lng: number }) => void;
  destination?: PlaceSelection | null;
  pickupLocation?: { lat: number; lng: number } | null;
  /** GeoJSON LineString for the cycling route */
  routeGeometry?: GeoJSON.LineString | null;
  /** Location of the bicycle/driver on the map */
  bikeLocation?: { lat: number; lng: number } | null;
  /** Whether to show expanding radar waves at pickup (searching for drivers) */
  searching?: boolean;
  className?: string;
}

export default function MapView({
  center = KIGALI_CENTER,
  zoom = DEFAULT_ZOOM,
  showUserLocation = true,
  interactive = true,
  onMapReady,
  onLocationFound,
  destination = null,
  pickupLocation = null,
  routeGeometry = null,
  bikeLocation = null,
  searching = false,
  className = '',
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const bikeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const configurationError = hasMapboxToken
    ? null
    : 'Add a valid public Mapbox token to VITE_MAPBOX_TOKEN and restart the dev server.';

  const initMap = useCallback(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!hasMapboxToken) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom,
      attributionControl: false,
      interactive,
    });

    resizeObserverRef.current = new ResizeObserver(() => map.resize());
    resizeObserverRef.current.observe(mapContainer.current);

    map.on('error', () => {
      setMapError('Mapbox could not load the map. Check that the token is valid and allows this site URL.');
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    if (showUserLocation) {
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.addControl(geolocate, 'bottom-right');
      map.on('load', () => geolocate.trigger());
      geolocate.on('geolocate', (e: GeolocationPosition) => {
        onLocationFound?.({
          lat: e.coords.latitude,
          lng: e.coords.longitude,
        });
      });
    }

    map.on('load', () => {
      setIsLoaded(true);
      map.resize();
      onMapReady?.(map);
    });

    mapRef.current = map;
  }, [center, zoom, showUserLocation, interactive, onMapReady, onLocationFound]);

  useEffect(() => {
    initMap();
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  // ── Destination marker ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!destination) {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      return;
    }

    const { lat, lng } = destination.location;
    if (!destinationMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:32px;height:32px;background:#F97316;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
      destinationMarkerRef.current = new mapboxgl.Marker({ element: el });
    }
    destinationMarkerRef.current
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(destination.name))
      .addTo(map);
  }, [destination]);

  // ── Pickup marker ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!pickupLocation) {
      pickupMarkerRef.current?.remove();
      pickupMarkerRef.current = null;
      return;
    }

    if (!pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="position:relative;"><div style="width:16px;height:16px;background:#F97316;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div><div class="pickup-pulse" style="position:absolute;top:-4px;left:-4px;width:24px;height:24px;background:rgba(249,115,22,0.3);border-radius:50%;"></div></div>`;
      pickupMarkerRef.current = new mapboxgl.Marker({ element: el });
    }
    pickupMarkerRef.current
      .setLngLat([pickupLocation.lng, pickupLocation.lat])
      .addTo(map);
  }, [pickupLocation]);

  // ── Bike marker (driver en route) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!bikeLocation) {
      bikeMarkerRef.current?.remove();
      bikeMarkerRef.current = null;
      return;
    }

    if (!bikeMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:36px;height:36px;background:#0F0F0F;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div>`;
      bikeMarkerRef.current = new mapboxgl.Marker({ element: el });
    }
    bikeMarkerRef.current
      .setLngLat([bikeLocation.lng, bikeLocation.lat])
      .addTo(map);
  }, [bikeLocation]);

  // ── Geographic radar waves (searching for drivers) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const removeRadarLayers = () => {
      if (map.getLayer(RADAR_LINE_LAYER_ID)) map.removeLayer(RADAR_LINE_LAYER_ID);
      if (map.getLayer(RADAR_FILL_LAYER_ID)) map.removeLayer(RADAR_FILL_LAYER_ID);
      if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
    };

    if (!searching || !pickupLocation) {
      removeRadarLayers();
      return;
    }

    const destinationPoint = (bearing: number, distanceMeters: number): [number, number] => {
      const earthRadiusMeters = 6_371_000;
      const angularDistance = distanceMeters / earthRadiusMeters;
      const bearingRadians = (bearing * Math.PI) / 180;
      const latitudeRadians = (pickupLocation.lat * Math.PI) / 180;
      const longitudeRadians = (pickupLocation.lng * Math.PI) / 180;
      const destinationLatitude = Math.asin(
        Math.sin(latitudeRadians) * Math.cos(angularDistance) +
          Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians)
      );
      const destinationLongitude =
        longitudeRadians +
        Math.atan2(
          Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
          Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitude)
        );

      return [(destinationLongitude * 180) / Math.PI, (destinationLatitude * 180) / Math.PI];
    };

    const createRing = (
      radiusMeters: number,
      thicknessMeters: number,
      opacity: number
    ): GeoJSON.Feature<GeoJSON.Polygon> => {
      const outerRing: [number, number][] = [];
      const innerRing: [number, number][] = [];
      const innerRadius = Math.max(1, radiusMeters - thicknessMeters);

      for (let segment = 0; segment <= RADAR_RING_SEGMENTS; segment += 1) {
        const bearing = (segment / RADAR_RING_SEGMENTS) * 360;
        outerRing.push(destinationPoint(bearing, radiusMeters));
        innerRing.push(destinationPoint(360 - bearing, innerRadius));
      }

      return {
        type: 'Feature',
        properties: { opacity },
        geometry: {
          type: 'Polygon',
          coordinates: [outerRing, innerRing],
        },
      };
    };

    const initialFeatures = Array.from({ length: RADAR_WAVE_COUNT }, () => createRing(1, 1, 0));

    removeRadarLayers();
    map.addSource(RADAR_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: initialFeatures },
    });
    map.addLayer({
      id: RADAR_FILL_LAYER_ID,
      type: 'fill',
      source: RADAR_SOURCE_ID,
      paint: {
        'fill-color': '#F97316',
        'fill-opacity': ['get', 'opacity'],
      },
    });
    map.addLayer({
      id: RADAR_LINE_LAYER_ID,
      type: 'line',
      source: RADAR_SOURCE_ID,
      paint: {
        'line-color': '#EA580C',
        'line-width': 2,
        'line-opacity': ['get', 'opacity'],
      },
    });

    map.easeTo({
      center: [pickupLocation.lng, pickupLocation.lat],
      zoom: Math.min(map.getZoom(), 13),
      duration: 700,
    });

    const source = map.getSource(RADAR_SOURCE_ID) as mapboxgl.GeoJSONSource;
    const startedAt = performance.now();
    let animationFrame = 0;
    let lastUpdate = 0;

    const animate = (now: number) => {
      if (now - lastUpdate >= 80) {
        const features = Array.from({ length: RADAR_WAVE_COUNT }, (_, index) => {
          const phase = ((now - startedAt) / RADAR_DURATION_MS + index / RADAR_WAVE_COUNT) % 1;
          const easedProgress = 1 - (1 - phase) ** 2;
          const radius = 80 + easedProgress * RADAR_MAX_RADIUS_METERS;
          const thickness = 45 + easedProgress * 55;
          const opacity = Math.max(0.04, 0.28 * (1 - phase));
          return createRing(radius, thickness, opacity);
        });
        source.setData({ type: 'FeatureCollection', features });
        lastUpdate = now;
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      removeRadarLayers();
    };
  }, [searching, pickupLocation, isLoaded]);

  // ── Route polyline ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const sourceId = 'route-source';
    const layerId = 'route-layer';
    const outlineLayerId = 'route-outline-layer';

    if (!routeGeometry) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const sourceData: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: routeGeometry,
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(sourceData);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: sourceData });

      map.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#EA580C', 'line-width': 8, 'line-opacity': 0.4 },
      });

      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F97316', 'line-width': 5, 'line-opacity': 0.9 },
      });
    }
  }, [routeGeometry, isLoaded]);

  // ── Fit bounds ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (pickupLocation && destination) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickupLocation.lng, pickupLocation.lat]);
      bounds.extend([destination.location.lng, destination.location.lat]);
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 280, left: 50, right: 50 },
        maxZoom: 16,
        duration: 800,
      });
    } else if (destination && !pickupLocation) {
      map.flyTo({ center: [destination.location.lng, destination.location.lat], zoom: 15 });
    }
  }, [pickupLocation, destination, isLoaded]);

  const displayedError = mapError ?? configurationError;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* CSS animations for markers */}
      <style>{`
        @keyframes pickup-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        .pickup-pulse {
          animation: pickup-pulse 2s infinite;
        }

      `}</style>

      {!isLoaded && !displayedError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-sunset border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm font-medium">Loading map...</span>
          </div>
        </div>
      )}
      {displayedError && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-600"
        >
          {displayedError}
        </div>
      )}
    </div>
  );
}
