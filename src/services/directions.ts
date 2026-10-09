import type * as GeoJSON from 'geojson';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface RouteInfo {
  /** GeoJSON LineString geometry for the route */
  geometry: GeoJSON.LineString;
  /** Distance in kilometers */
  distanceKm: number;
  /** Duration in minutes */
  durationMin: number;
}

/**
 * Fetch cycling route between two points using Mapbox Directions API.
 * Uses the 'cycling' profile since Tugende is a bicycle platform.
 */
export async function fetchCyclingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteInfo> {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/cycling/${from.lng},${from.lat};${to.lng},${to.lat}`
  );
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('access_token', MAPBOX_TOKEN);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox Directions API error: ${res.status}`);
  }

  const data = await res.json();
  const route = data.routes?.[0];

  if (!route) {
    throw new Error('No cycling route found between these locations.');
  }

  return {
    geometry: route.geometry as GeoJSON.LineString,
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMin: Math.round(route.duration / 60),
  };
}
