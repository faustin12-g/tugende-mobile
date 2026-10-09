export interface User {
  id: string;
  email?: string;
  phone?: string | null;
  name: string;
  role: 'passenger' | 'driver';
  avatarUrl?: string;
  createdAt: string;
}

export interface Driver extends User {
  role: 'driver';
  bicycleNumber: string;
  isOnline: boolean;
  rating: number;
  totalRides: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Passenger extends User {
  role: 'passenger';
  savedPlaces?: SavedPlace[];
}

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RideRequest {
  id: string;
  passengerId: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  estimatedFare: number;
  passengerOffer: number | null;
  status: 'pending' | 'bidding' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface NearbyRideRequest extends Omit<RideRequest, 'passengerOffer'> {
  passengerOffer: number;
  pickupDistanceMeters: number;
  driverBid?: number;
}

export interface RideBid {
  id: string;
  rideRequestId: string;
  driverId: string;
  driverName: string;
  bicycleNumber: string | null;
  proposedFare: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ParcelDelivery {
  id: string;
  senderId: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  distanceKm: number;
  durationMin: number;
  estimatedFare: number;
  senderOffer: number;
  status: RideRequest['status'];
  createdAt: string;
}

export interface NearbyParcelDelivery
  extends Omit<ParcelDelivery, 'senderName' | 'senderPhone' | 'recipientName' | 'recipientPhone'> {
  pickupDistanceMeters: number;
  driverBid?: number;
}

export interface ParcelBid {
  id: string;
  parcelDeliveryId: string;
  driverId: string;
  driverName: string;
  bicycleNumber: string | null;
  proposedFare: number;
  status: RideBid['status'];
  createdAt: string;
}

export type TrackableType = 'ride' | 'parcel';

export interface TripTracking {
  type: TrackableType;
  id: string;
  status: RideRequest['status'];
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  driverLocation: { lat: number; lng: number; heading: number | null } | null;
  updatedAt: string | null;
  expiresAt: string | null;
}

export interface DriverActiveTrip extends TripTracking {
  agreedFare: number;
}

export interface Bid {
  id: string;
  rideRequestId: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  proposedFare: number;
  estimatedArrival: number; // minutes
  createdAt: string;
}

export type OnboardingSlide = {
  id: number;
  title: string;
  description: string;
  icon: string;
  bgGradient: string;
};
