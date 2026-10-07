import { create } from 'zustand';
import type { RideRequest } from '../types';
import type { PlaceSelection } from '../services/googlePlaces';
import type { RouteInfo } from '../services/directions';

export type RideStatus =
  | 'idle'
  | 'confirming'
  | 'requesting'
  | 'waiting'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

interface RideState {
  // Location
  pickup: { address: string; lat: number; lng: number } | null;
  destination: PlaceSelection | null;

  // Route info
  route: RouteInfo | null;
  estimatedFare: number;

  // Active request
  activeRequest: RideRequest | null;
  status: RideStatus;
  error: string | null;

  // Actions
  setPickup: (pickup: { address: string; lat: number; lng: number }) => void;
  setDestination: (dest: PlaceSelection | null) => void;
  setRoute: (route: RouteInfo, fare: number) => void;
  setStatus: (status: RideStatus) => void;
  setActiveRequest: (request: RideRequest) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  pickup: null,
  destination: null,
  route: null,
  estimatedFare: 0,
  activeRequest: null,
  status: 'idle' as RideStatus,
  error: null,
};

export const useRideStore = create<RideState>()((set) => ({
  ...initialState,

  setPickup: (pickup) => set({ pickup }),
  setDestination: (destination) => set({ destination }),
  setRoute: (route, estimatedFare) => set({ route, estimatedFare, status: 'confirming' }),
  setStatus: (status) => set({ status }),
  setActiveRequest: (activeRequest) => set({ activeRequest }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
