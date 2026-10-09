import { fetchCyclingRoute, type RouteInfo } from './directions';
import { calculateFare } from '../utils/fareCalculator';
import { getSupabaseClient } from './supabase';
import type { NearbyRideRequest, RideBid, RideRequest } from '../types';

interface CreateRideParams {
  passengerId: string;
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  passengerOffer: number;
}

export function getRideServiceErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return fallback;

  const serviceError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    status?: unknown;
  };
  const code = typeof serviceError.code === 'string' ? serviceError.code : '';
  const message = typeof serviceError.message === 'string' ? serviceError.message : '';
  const details = typeof serviceError.details === 'string' ? serviceError.details : '';
  const hint = typeof serviceError.hint === 'string' ? serviceError.hint : '';

  if (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    serviceError.status === 404 ||
    /could not find the (table|column|function)|relation .* does not exist/i.test(message)
  ) {
    return 'Ride database setup is missing or not refreshed in Supabase. Run supabase/ride-offer-migration.sql in the Supabase SQL Editor, then refresh the app.';
  }

  return [message, details, hint].filter(Boolean).join(' — ') || fallback;
}

export async function createRideRequest(
  params: CreateRideParams
): Promise<{ request: RideRequest; route: RouteInfo }> {
  const route = await fetchCyclingRoute(
    { lat: params.pickup.lat, lng: params.pickup.lng },
    { lat: params.destination.lat, lng: params.destination.lng }
  );
  const estimatedFare = calculateFare(route.distanceKm);

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

export async function getNearbyRideRequests(
  location: { lat: number; lng: number },
  radiusMeters = 2000
): Promise<NearbyRideRequest[]> {
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .select(
      'id, passenger_id, pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng, estimated_fare, passenger_offer, status, created_at'
    )
    .in('status', ['pending', 'bidding'])
    .not('passenger_offer', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!data?.length) return [];

  const requests = data
    .map((row) => {
      if (row.passenger_offer == null) return null;
      const distance = distanceBetweenMeters(
        location,
        { lat: row.pickup_lat, lng: row.pickup_lng }
      );
      return {
        id: row.id,
        passengerId: row.passenger_id,
        pickup: {
          address: row.pickup_address,
          lat: row.pickup_lat,
          lng: row.pickup_lng,
        },
        destination: {
          address: row.destination_address,
          lat: row.destination_lat,
          lng: row.destination_lng,
        },
        estimatedFare: row.estimated_fare,
        passengerOffer: row.passenger_offer,
        status: row.status as RideRequest['status'],
        createdAt: row.created_at,
        pickupDistanceMeters: distance,
      } satisfies NearbyRideRequest;
    })
    .filter(
      (request): request is NearbyRideRequest =>
        request !== null && request.pickupDistanceMeters <= radiusMeters
    );

  if (!requests.length) return [];

  const { data: driverBids, error: bidsError } = await getSupabaseClient()
    .from('ride_bids')
    .select('ride_request_id, proposed_fare')
    .in('ride_request_id', requests.map((request) => request.id));

  if (bidsError) throw bidsError;

  const bidAmounts = new Map(
    driverBids?.map((bid) => [bid.ride_request_id, bid.proposed_fare]) ?? []
  );

  return requests.map((request) => ({
    ...request,
    driverBid: bidAmounts.get(request.id),
  }));
}

export async function submitRideBid(
  requestId: string,
  driverId: string,
  proposedFare: number
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('ride_bids')
    .insert({
      ride_request_id: requestId,
      driver_id: driverId,
      proposed_fare: proposedFare,
    });

  if (error) throw error;
}

export async function getRideBids(requestId: string): Promise<RideBid[]> {
  const { data, error } = await getSupabaseClient().rpc('get_ride_bids', {
    p_request_id: requestId,
  });

  if (error) throw error;
  return (data ?? []).map((row: {
    id: string;
    driver_id: string;
    driver_name: string;
    bicycle_number: string | null;
    proposed_fare: number;
    status: string;
    created_at: string;
  }) => ({
    id: row.id,
    rideRequestId: requestId,
    driverId: row.driver_id,
    driverName: row.driver_name,
    bicycleNumber: row.bicycle_number,
    proposedFare: row.proposed_fare,
    status: row.status as RideBid['status'],
    createdAt: row.created_at,
  }));
}

export async function respondToRideBid(bidId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('respond_to_ride_bid', {
    p_bid_id: bidId,
    p_accept: accept,
  });

  if (error) throw error;
}

function distanceBetweenMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
