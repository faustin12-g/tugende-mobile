import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PlaceSelection } from '../../services/googlePlaces';

// Kigali center coordinates
const KIGALI_CENTER: [number, number] = [29.8739, -1.9403];
const DEFAULT_ZOOM = 14;
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN?.trim();
const hasMapboxToken = Boolean(mapboxToken?.startsWith('pk.'));

if (hasMapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

export interface MapViewProps {
  /** Center of the map [lng, lat]. Defaults to Kigali city center. */
  center?: [number, number];
  /** Zoom level. Defaults to 14. */
  zoom?: number;
  /** Whether to track and show the user's current location */
  showUserLocation?: boolean;
  /** Whether to show a pulsing dot at the user's location */
  interactive?: boolean;
  /** Callback when map is loaded */
  onMapReady?: (map: mapboxgl.Map) => void;
  /** Callback when user location is found */
  onLocationFound?: (coords: { lat: number; lng: number }) => void;
  /** Selected destination to show on the map */
  destination?: PlaceSelection | null;
  /** Additional CSS classes for the container */
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
  className = '',
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

    // Add minimal attribution (required by Mapbox TOS)
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    // Add user location tracking
    if (showUserLocation) {
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });

      map.addControl(geolocate, 'bottom-right');

      map.on('load', () => {
        // Auto-trigger geolocation after map loads
        geolocate.trigger();
      });

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
      destinationMarkerRef.current = new mapboxgl.Marker({ color: '#f97316' });
    }
    destinationMarkerRef.current
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(destination.name))
      .addTo(map);
    map.flyTo({ center: [lng, lat], zoom: 15 });
  }, [destination]);

  const displayedError = mapError ?? configurationError;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
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
