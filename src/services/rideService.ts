import { fetchCyclingRoute, type RouteInfo } from './directions';
import { calculateFare } from '../utils/fareCalculator';
import { getSupabaseClient } from './supabase';
import type {
  NearbyParcelDelivery,
  NearbyRideRequest,
  DriverActiveTrip,
  ParcelBid,
  ParcelDelivery,
  RideBid,
  RideRequest,
  TrackableType,
  TripTracking,
} from '../types';

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
    if (/trip_tracking|set_trip_status|tracking/i.test(message)) {
      return 'Live tracking setup is missing. Run supabase/trip-tracking-migration.sql in the Supabase SQL Editor, then refresh the app.';
    }
    const migration = /parcel/i.test(message)
      ? 'supabase/parcel-delivery-migration.sql'
      : 'supabase/ride-offer-migration.sql';
    return `Database setup is missing or not refreshed in Supabase. Run ${migration} in the Supabase SQL Editor, then refresh the app.`;
  }

  return [message, details, hint].filter(Boolean).join(' — ') || fallback;
}

interface TrackingRow {
  trip_type: TrackableType;
  trip_id: string;
  status: RideRequest['status'];
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  driver_latitude: number | null;
  driver_longitude: number | null;
  driver_heading: number | null;
  location_updated_at: string | null;
  expires_at?: string | null;
}

function mapTrackingRow(row: TrackingRow): TripTracking {
  return {
    type: row.trip_type,
    id: row.trip_id,
    status: row.status,
    pickup: { address: row.pickup_address, lat: row.pickup_lat, lng: row.pickup_lng },
    destination: {
      address: row.destination_address,
      lat: row.destination_lat,
      lng: row.destination_lng,
    },
    driverLocation:
      row.driver_latitude === null || row.driver_longitude === null
        ? null
        : {
            lat: row.driver_latitude,
            lng: row.driver_longitude,
            heading: row.driver_heading,
          },
    updatedAt: row.location_updated_at,
    expiresAt: row.expires_at ?? null,
  };
}

export async function getTripTracking(type: TrackableType, tripId: string): Promise<TripTracking> {
  const { data, error } = await getSupabaseClient().rpc('get_trip_tracking', {
    p_type: type,
    p_trip_id: tripId,
  });
  if (error) throw error;
  const row = (data as TrackingRow[] | null)?.[0];
  if (!row) throw new Error('Trip tracking is not available for this account.');
  return mapTrackingRow(row);
}

export async function getPublicTripTracking(token: string): Promise<TripTracking | null> {
  const { data, error } = await getSupabaseClient().rpc('get_public_trip_tracking', {
    p_token: token,
  });
  if (error) throw error;
  const row = (data as TrackingRow[] | null)?.[0];
  return row ? mapTrackingRow(row) : null;
}

export async function createTripTrackingShare(
  type: TrackableType,
  tripId: string
): Promise<{ id: string; url: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  const { data, error } = await getSupabaseClient().rpc('create_trip_tracking_share', {
    p_type: type,
    p_trip_id: tripId,
    p_token: token,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Could not create a tracking link.');
  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim() || window.location.origin;
  return { id: data, url: new URL(`/track/${token}`, publicAppUrl).toString() };
}

export async function revokeTripTrackingShare(shareId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('revoke_trip_tracking_share', {
    p_share_id: shareId,
  });
  if (error) throw error;
}

export async function setTripStatus(
  type: TrackableType,
  tripId: string,
  status: 'in_progress' | 'completed'
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_trip_status', {
    p_type: type,
    p_trip_id: tripId,
    p_status: status,
  });
  if (error) throw error;
}

export async function publishTripLocation(
  type: TrackableType,
  tripId: string,
  location: { lat: number; lng: number; heading: number | null }
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('publish_trip_location', {
    p_type: type,
    p_trip_id: tripId,
    p_latitude: location.lat,
    p_longitude: location.lng,
    p_heading: location.heading,
  });
  if (error) throw error;
}

export async function getDriverActiveTrips(): Promise<DriverActiveTrip[]> {
  const supabase = getSupabaseClient();
  const [rides, parcels] = await Promise.all([
    supabase.rpc('get_driver_active_rides'),
    supabase.rpc('get_driver_active_parcels'),
  ]);
  if (rides.error) throw rides.error;
  if (parcels.error) throw parcels.error;

  const rideTrips = (rides.data ?? []).map((row: {
    id: string;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    destination_address: string;
    destination_lat: number;
    destination_lng: number;
    passenger_offer: number;
    status: string;
    agreed_fare: number | null;
  }) => ({
    type: 'ride' as const,
    id: row.id,
    status: row.status as RideRequest['status'],
    pickup: { address: row.pickup_address, lat: row.pickup_lat, lng: row.pickup_lng },
    destination: {
      address: row.destination_address,
      lat: row.destination_lat,
      lng: row.destination_lng,
    },
    driverLocation: null,
    updatedAt: null,
    expiresAt: null,
    agreedFare: row.agreed_fare ?? row.passenger_offer,
  }));
  const parcelTrips = (parcels.data ?? []).map((row: {
    id: string;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    destination_address: string;
    destination_lat: number;
    destination_lng: number;
    sender_offer: number;
    status: string;
    agreed_fare: number | null;
  }) => ({
    type: 'parcel' as const,
    id: row.id,
    status: row.status as RideRequest['status'],
    pickup: { address: row.pickup_address, lat: row.pickup_lat, lng: row.pickup_lng },
    destination: {
      address: row.destination_address,
      lat: row.destination_lat,
      lng: row.destination_lng,
    },
    driverLocation: null,
    updatedAt: null,
    expiresAt: null,
    agreedFare: row.agreed_fare ?? row.sender_offer,
  }));
  return [...rideTrips, ...parcelTrips];
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

interface CreateParcelDeliveryParams {
  senderId: string;
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  senderOffer: number;
}

export async function createParcelDelivery(
  params: CreateParcelDeliveryParams
): Promise<ParcelDelivery> {
  const route = await fetchCyclingRoute(params.pickup, params.destination);
  const estimatedFare = calculateFare(route.distanceKm);
  const { data, error } = await getSupabaseClient()
    .from('parcel_deliveries')
    .insert({
      sender_id: params.senderId,
      pickup_address: params.pickup.address,
      pickup_lat: params.pickup.lat,
      pickup_lng: params.pickup.lng,
      destination_address: params.destination.address,
      destination_lat: params.destination.lat,
      destination_lng: params.destination.lng,
      sender_name: params.senderName,
      sender_phone: params.senderPhone,
      recipient_name: params.recipientName,
      recipient_phone: params.recipientPhone,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      estimated_fare: estimatedFare,
      sender_offer: params.senderOffer,
    })
    .select(
      'id, sender_id, pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng, distance_km, duration_min, estimated_fare, sender_offer, status, created_at'
    )
    .single();

  if (error) throw error;
  return {
    ...mapParcelDelivery({
      ...data,
      sender_name: params.senderName,
      sender_phone: params.senderPhone,
      recipient_name: params.recipientName,
      recipient_phone: params.recipientPhone,
    }),
  };
}

export async function cancelParcelDelivery(deliveryId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('parcel_deliveries')
    .update({ status: 'cancelled' })
    .eq('id', deliveryId);

  if (error) throw error;
}

export async function getNearbyParcelDeliveries(
  location: { lat: number; lng: number },
  radiusMeters = 2000
): Promise<NearbyParcelDelivery[]> {
  const { data, error } = await getSupabaseClient()
    .from('parcel_deliveries')
    .select(
      'id, sender_id, pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng, distance_km, duration_min, estimated_fare, sender_offer, status, created_at'
    )
    .in('status', ['pending', 'bidding'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!data?.length) return [];

  const deliveries = data
    .map((row) => ({
      id: row.id,
      senderId: row.sender_id,
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
      distanceKm: Number(row.distance_km),
      durationMin: row.duration_min,
      estimatedFare: row.estimated_fare,
      senderOffer: row.sender_offer,
      status: row.status as ParcelDelivery['status'],
      createdAt: row.created_at,
      pickupDistanceMeters: distanceBetweenMeters(location, {
        lat: row.pickup_lat,
        lng: row.pickup_lng,
      }),
    } satisfies NearbyParcelDelivery))
    .filter((delivery) => delivery.pickupDistanceMeters <= radiusMeters);
  if (!deliveries.length) return [];

  const { data: bids, error: bidsError } = await getSupabaseClient()
    .from('parcel_bids')
    .select('parcel_delivery_id, proposed_fare')
    .in('parcel_delivery_id', deliveries.map((delivery) => delivery.id));
  if (bidsError) throw bidsError;

  const bidAmounts = new Map(
    bids?.map((bid) => [bid.parcel_delivery_id, bid.proposed_fare]) ?? []
  );

  return deliveries.map((delivery) => ({
    ...delivery,
    driverBid: bidAmounts.get(delivery.id),
  }));
}

export async function submitParcelBid(
  deliveryId: string,
  driverId: string,
  proposedFare: number
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('parcel_bids')
    .insert({
      parcel_delivery_id: deliveryId,
      driver_id: driverId,
      proposed_fare: proposedFare,
    });

  if (error) throw error;
}

export async function getParcelBids(deliveryId: string): Promise<ParcelBid[]> {
  const { data, error } = await getSupabaseClient().rpc('get_parcel_bids', {
    p_delivery_id: deliveryId,
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
    parcelDeliveryId: deliveryId,
    driverId: row.driver_id,
    driverName: row.driver_name,
    bicycleNumber: row.bicycle_number,
    proposedFare: row.proposed_fare,
    status: row.status as ParcelBid['status'],
    createdAt: row.created_at,
  }));
}

export async function respondToParcelBid(bidId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('respond_to_parcel_bid', {
    p_bid_id: bidId,
    p_accept: accept,
  });
  if (error) throw error;
}

function mapParcelDelivery(row: Record<string, unknown>): ParcelDelivery {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    pickup: {
      address: row.pickup_address as string,
      lat: row.pickup_lat as number,
      lng: row.pickup_lng as number,
    },
    destination: {
      address: row.destination_address as string,
      lat: row.destination_lat as number,
      lng: row.destination_lng as number,
    },
    senderName: row.sender_name as string,
    senderPhone: row.sender_phone as string,
    recipientName: row.recipient_name as string,
    recipientPhone: row.recipient_phone as string,
    distanceKm: Number(row.distance_km),
    durationMin: row.duration_min as number,
    estimatedFare: row.estimated_fare as number,
    senderOffer: row.sender_offer as number,
    status: row.status as ParcelDelivery['status'],
    createdAt: row.created_at as string,
  };
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
