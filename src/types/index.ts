export interface User {
  id: string;
  phone: string;
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
  status: 'pending' | 'bidding' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
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
