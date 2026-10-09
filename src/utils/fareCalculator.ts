/**
 * Tugende Fare Calculator
 * Base fare + per-km rate for bicycle rides in Kigali.
 */

const BASE_FARE_RWF = 200;
const PER_KM_RATE_RWF = 150;
const MINIMUM_FARE_RWF = 300;

/**
 * Calculate estimated fare based on distance.
 * @param distanceKm - Distance in kilometers
 * @returns Fare in RWF, rounded to nearest 50
 */
export function calculateFare(distanceKm: number): number {
  const rawFare = BASE_FARE_RWF + distanceKm * PER_KM_RATE_RWF;
  const fare = Math.max(rawFare, MINIMUM_FARE_RWF);
  // Round to nearest 50 RWF for clean pricing
  return Math.round(fare / 50) * 50;
}

/**
 * Format fare for display.
 * @param fare - Fare in RWF
 * @returns Formatted string like "350 RWF"
 */
export function formatFare(fare: number): string {
  return `${fare.toLocaleString()} RWF`;
}

/**
 * Format distance for display.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Format duration for display.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'Less than 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}
