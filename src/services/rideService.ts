import { fetchCyclingRoute, type RouteInfo } from './directions';
import { calculateFare } from '../utils/fareCalculator';
import { getSupabaseClient } from './supabase';
import type { RideRequest } from '../types';

const IS_DEV = import.meta.env.DEV;

interface CreateRideParams {
  passengerId: string;
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  passengerOffer: number;
}

/**
 * Create a ride request — in dev mode, simulates locally.
 * In production, persists to Supabase.
 */
export async function createRideRequest(
  params: CreateRideParams
): Promise<{ request: RideRequest; route: RouteInfo }> {
  // 1. Get the cycling route
  const route = await fetchCyclingRoute(
    { lat: params.pickup.lat, lng: params.pickup.lng },
    { lat: params.destination.lat, lng: params.destination.lng }
  );

  // 2. Calculate fare
  const estimatedFare = calculateFare(route.distanceKm);

  // 3. Dev mode: simulate locally without Supabase
  if (IS_DEV) {
    const request: RideRequest = {
      id: crypto.randomUUID(),
      passengerId: params.passengerId,
      pickup: params.pickup,
      destination: params.destination,
      estimatedFare,
      passengerOffer: params.passengerOffer,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    return { request, route };
  }

  // 4. Production: insert into Supabase
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .insert({
      passenger_id: params.passengerId,
      pickup_address: params.pickup.address,
      pickup_lat: params.pickup.lat,
      pickup_lng: params.pickup.lng,
      destination_address: params.destination.address,
      destination_lat: params.destination.lat,
      destination_lng: params.destination.lng,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      estimated_fare: estimatedFare,
      passenger_offer: params.passengerOffer,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  const request: RideRequest = {
    id: data.id,
    passengerId: data.passenger_id,
    pickup: {
      address: data.pickup_address,
      lat: data.pickup_lat,
      lng: data.pickup_lng,
    },
    destination: {
      address: data.destination_address,
      lat: data.destination_lat,
      lng: data.destination_lng,
    },
    estimatedFare: data.estimated_fare,
    passengerOffer: data.passenger_offer,
    status: data.status,
    createdAt: data.created_at,
  };

  return { request, route };
}

/**
 * Cancel an active ride request.
 */
export async function cancelRideRequest(requestId: string): Promise<void> {
  if (IS_DEV) {
    console.log(`[DEV] Cancelled ride request ${requestId}`);
    return;
  }

  const { error } = await getSupabaseClient()
    .from('ride_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (error) throw error;
}

/**
 * Get the passenger's current active ride request (if any).
 */
export async function getActiveRequest(
  passengerId: string
): Promise<RideRequest | null> {
  if (IS_DEV) return null;

  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .select()
    .eq('passenger_id', passengerId)
    .in('status', ['pending', 'bidding', 'accepted', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    passengerId: data.passenger_id,
    pickup: {
      address: data.pickup_address,
      lat: data.pickup_lat,
      lng: data.pickup_lng,
    },
    destination: {
      address: data.destination_address,
      lat: data.destination_lat,
      lng: data.destination_lng,
    },
    estimatedFare: data.estimated_fare,
    passengerOffer: data.passenger_offer,
    status: data.status,
    createdAt: data.created_at,
  };
}

/**
 * Subscribe to real-time updates on a ride request.
 */
export function subscribeToRideRequest(
  requestId: string,
  onUpdate: (request: RideRequest) => void
) {
  if (IS_DEV) {
    console.log(`[DEV] Subscribed to ride request ${requestId}`);
    return { unsubscribe: () => {} };
  }

  return getSupabaseClient()
    .channel(`ride-${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ride_requests',
        filter: `id=eq.${requestId}`,
      },
      (payload: { new: Record<string, unknown> }) => {
        const data = payload.new;
        onUpdate({
          id: data.id as string,
          passengerId: data.passenger_id as string,
          pickup: {
            address: data.pickup_address as string,
            lat: data.pickup_lat as number,
            lng: data.pickup_lng as number,
          },
          destination: {
            address: data.destination_address as string,
            lat: data.destination_lat as number,
            lng: data.destination_lng as number,
          },
          estimatedFare: data.estimated_fare as number,
          passengerOffer: data.passenger_offer as number,
          status: data.status as RideRequest['status'],
          createdAt: data.created_at as string,
        });
      }
    )
    .subscribe();
}
