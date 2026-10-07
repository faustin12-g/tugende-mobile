import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Route,
  X,
} from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import DestinationSearch from '../../components/map/DestinationSearch';
import MapView from '../../components/map/MapView';
import MapSettings from '../../components/map/MapSettings';
import { useAuthStore } from '../../store/authStore';
import { useRideStore } from '../../store/rideStore';
import { fetchCyclingRoute } from '../../services/directions';
import { createRideRequest, cancelRideRequest } from '../../services/rideService';
import { calculateFare, formatFare, formatDistance, formatDuration } from '../../utils/fareCalculator';
import type { PlaceSelection } from '../../services/googlePlaces';

export default function PassengerHome() {
  const { user } = useAuthStore();
  const {
    pickup,
    destination,
    route,
    estimatedFare,
    activeRequest,
    status,
    error,
    setPickup,
    setDestination,
    setRoute,
    setStatus,
    setActiveRequest,
    setError,
    reset,
  } = useRideStore();

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [offerAmount, setOfferAmount] = useState('');
  const [isSettingOffer, setIsSettingOffer] = useState(false);
  const waitingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-set pickup to user's GPS location
  const handleLocationFound = useCallback(
    (coords: { lat: number; lng: number }) => {
      setUserLocation(coords);
      if (!pickup) {
        setPickup({ address: 'Current Location', lat: coords.lat, lng: coords.lng });
      }
    },
    [pickup, setPickup]
  );

  // When destination is selected, fetch the cycling route
  const handleDestinationSelect = useCallback(
    async (place: PlaceSelection | null) => {
      setDestination(place);
      setError(null);

      if (!place || !pickup) return;

      try {
        const routeInfo = await fetchCyclingRoute(
          { lat: pickup.lat, lng: pickup.lng },
          place.location
        );
        const fare = calculateFare(routeInfo.distanceKm);
        setRoute(routeInfo, fare);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not fetch route');
      }
    },
    [pickup, setDestination, setRoute, setError]
  );

  // Submit ride request
  const handleRequestRide = useCallback(async () => {
    if (!user || !pickup || !destination) return;

    const passengerOffer = Number(offerAmount);
    if (!Number.isSafeInteger(passengerOffer) || passengerOffer <= 0) {
      setError('Enter a valid offer greater than 0 RWF.');
      return;
    }

    setStatus('requesting');
    setError(null);

    try {
      const { request } = await createRideRequest({
        passengerId: user.id,
        pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
        destination: {
          address: destination.address,
          lat: destination.location.lat,
          lng: destination.location.lng,
        },
        passengerOffer,
      });

      setActiveRequest(request);
      setStatus('waiting');
      setWaitingSeconds(0);

      // Start waiting timer
      waitingInterval.current = setInterval(() => {
        setWaitingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ride request');
      setStatus('confirming');
    }
  }, [user, pickup, destination, offerAmount, setStatus, setError, setActiveRequest]);

  const handleBeginRequest = useCallback(() => {
    setOfferAmount('');
    setError(null);
    setIsSettingOffer(true);
  }, [setError]);

  // Cancel ride request
  const handleCancel = useCallback(async () => {
    if (waitingInterval.current) {
      clearInterval(waitingInterval.current);
      waitingInterval.current = null;
    }

    if (activeRequest) {
      try {
        await cancelRideRequest(activeRequest.id);
      } catch {
        // Best effort cancel
      }
    }

    reset();
    setOfferAmount('');
    setIsSettingOffer(false);
    setWaitingSeconds(0);
  }, [activeRequest, reset]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (waitingInterval.current) clearInterval(waitingInterval.current);
    };
  }, []);

  const formatWaitTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <PageContainer withPadding={false} className="relative h-screen !min-h-0">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-center z-10">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
          <h1 className="text-xl font-bold text-black tracking-tight">Tugende</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-sunset/10">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-sunset">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <span className="max-w-[100px] truncate text-sm font-semibold text-black">
              {user?.name || 'Passenger'}
            </span>
          </div>
          <MapSettings />
        </div>
      </div>

      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <MapView
          showUserLocation
          onLocationFound={handleLocationFound}
          destination={destination}
          pickupLocation={status === 'confirming' || status === 'requesting' || status === 'waiting' ? pickup : null}
          searching={status === 'requesting' || status === 'waiting'}
          routeGeometry={route?.geometry ?? null}
        />
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence mode="wait">
        {/* ═══ IDLE STATE ═══ */}
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 space-y-4 z-10"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />
            
            {/* Greeting */}
            <p className="text-lg font-bold text-black">
              Hello, {user?.name?.split(' ')[0] || 'there'} 👋
            </p>

            {/* Search */}
            <DestinationSearch
              userLocation={userLocation}
              selectedPlace={destination}
              onSelect={handleDestinationSelect}
            />

            {/* Quick actions */}
            <div className="flex gap-3">
              <Button variant="outline" fullWidth className="py-4">
                <Bike aria-hidden="true" className="mr-2 h-5 w-5" /> Book a Ride
              </Button>
              <Button variant="outline" fullWidth className="py-4">
                <Package aria-hidden="true" className="mr-2 h-5 w-5" /> Send Parcel
              </Button>
            </div>

            {error && (
              <p className="text-sm text-red text-center">{error}</p>
            )}

            {userLocation && (
              <p className="text-xs text-gray-400 text-center">
                <MapPin aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                Location found • Ready to book
              </p>
            )}
          </motion.div>
        )}

        {/* ═══ CONFIRMING STATE ═══ */}
        {status === 'confirming' && route && destination && (
          <motion.div
            key="confirming"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 z-10"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-4" />

            {/* Route summary */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-black">
                {isSettingOffer ? 'Set Your Offer' : 'Confirm Your Ride'}
              </h2>
              <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Pickup & Destination */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
                <div>
                  <p className="text-xs text-gray-400 font-medium">PICKUP</p>
                  <p className="text-sm font-semibold text-black truncate">{pickup?.address}</p>
                </div>
              </div>
              <div className="ml-1.5 border-l-2 border-dashed border-gray-200 h-4" />
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-sunset border-2 border-white shadow" />
                <div>
                  <p className="text-xs text-gray-400 font-medium">DESTINATION</p>
                  <p className="text-sm font-semibold text-black truncate">{destination.name}</p>
                </div>
              </div>
            </div>

            {/* Trip estimate */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Route className="w-4 h-4 text-sunset mx-auto mb-1" />
                <p className="text-sm font-bold text-black">{formatDistance(route.distanceKm)}</p>
                <p className="text-xs text-gray-400">Distance</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-sunset mx-auto mb-1" />
                <p className="text-sm font-bold text-black">{formatDuration(route.durationMin)}</p>
                <p className="text-xs text-gray-400">Est. Time</p>
              </div>
            </div>

            <div className="rounded-xl bg-sunset/5 px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-black">Estimated fare: {formatFare(estimatedFare)}</p>
              <p className="text-xs text-gray-500 mt-1">
                This is a guide only. Your request will use the offer you choose.
              </p>
            </div>

            {isSettingOffer && (
              <label className="block mb-4">
                <span className="mb-2 block text-sm font-semibold text-black">Your offer (RWF)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={offerAmount}
                  onChange={(event) => setOfferAmount(event.target.value)}
                  placeholder="Enter the amount you want to pay"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-black outline-none focus:border-sunset focus:ring-2 focus:ring-sunset/20"
                  aria-label="Your offer in RWF"
                />
                <span className="mt-2 block text-xs text-gray-500">
                  Nearby drivers will see your offer and can respond with a bid.
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red text-center mb-3">{error}</p>
            )}

            {isSettingOffer ? (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSettingOffer(false);
                    setError(null);
                  }}
                  className="py-4"
                >
                  Back
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleRequestRide}
                  disabled={!Number.isSafeInteger(Number(offerAmount)) || Number(offerAmount) <= 0}
                  className="py-4 text-base"
                >
                  <Navigation className="mr-2 h-5 w-5" />
                  Send Ride Request
                </Button>
              </div>
            ) : (
              <Button
                fullWidth
                size="lg"
                onClick={handleBeginRequest}
                className="py-4 text-base"
              >
                <Navigation className="mr-2 h-5 w-5" />
                Request Ride
              </Button>
            )}
          </motion.div>
        )}

        {/* ═══ REQUESTING STATE ═══ */}
        {status === 'requesting' && (
          <motion.div
            key="requesting"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-8 pb-12 z-10 flex flex-col items-center"
          >
            <Loader2 className="w-10 h-10 text-sunset animate-spin mb-4" />
            <p className="text-lg font-bold text-black">Submitting your request...</p>
            <p className="text-sm text-gray-400 mt-1">Finding nearby riders</p>
          </motion.div>
        )}

        {/* ═══ WAITING STATE ═══ */}
        {status === 'waiting' && (
          <motion.div
            key="waiting"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 z-10"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-6" />

            <div className="flex flex-col items-center text-center">
              {/* Pulsing bike animation */}
              <div className="relative mb-4">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-sunset/20 rounded-full"
                  style={{ width: 80, height: 80, top: -10, left: -10 }}
                />
                <div className="w-16 h-16 bg-sunset/10 rounded-full flex items-center justify-center relative z-10">
                  <span className="text-3xl">🚲</span>
                </div>
              </div>

              <h2 className="text-xl font-bold text-black mb-1">Looking for riders...</h2>
              <p className="text-sm text-gray-400 mb-1">Nearby bicycle riders can see your request</p>
              
              {/* Timer */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 mt-3 mb-6">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-mono font-bold text-black">
                  {formatWaitTime(waitingSeconds)}
                </span>
              </div>

              {/* Ride details summary */}
              <div className="w-full bg-gray-50 rounded-2xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-500 truncate">{pickup?.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sunset" />
                  <span className="text-xs text-gray-500 truncate">{destination?.name}</span>
                </div>
                <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between">
                  <span className="text-xs text-gray-400">Your offer</span>
                  <span className="text-sm font-bold text-sunset">
                    {activeRequest ? formatFare(activeRequest.passengerOffer) : '—'}
                  </span>
                </div>
              </div>

              {/* Cancel button */}
              <Button variant="ghost" fullWidth onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" /> Cancel Request
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
