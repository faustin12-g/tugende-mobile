import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bike,
  Clock,
  Loader2,
  Navigation,
  Package,
  Route,
  Share2,
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
import {
  cancelRideRequest,
  createRideRequest,
  getRideServiceErrorMessage,
  getRideBids,
  getTripTracking,
  createTripTrackingShare,
  revokeTripTrackingShare,
  respondToRideBid,
} from '../../services/rideService';
import { calculateFare, formatFare, formatDistance, formatDuration } from '../../utils/fareCalculator';
import type { PlaceSelection } from '../../services/googlePlaces';
import type { RideBid } from '../../types';
import type { TripTracking } from '../../types';

export default function PassengerHome() {
  const navigate = useNavigate();
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
  const [isBookingRide, setIsBookingRide] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [offerAmount, setOfferAmount] = useState('');
  const [isSettingOffer, setIsSettingOffer] = useState(false);
  const [rideBids, setRideBids] = useState<RideBid[]>([]);
  const [acceptedBid, setAcceptedBid] = useState<RideBid | null>(null);
  const [respondingBidId, setRespondingBidId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [shareInfo, setShareInfo] = useState<{ id: string; url: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
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

      if (!place) {
        setIsLoadingRoute(false);
        return;
      }

      const pickupLocation = pickup ?? (
        userLocation
          ? { address: 'Current Location', lat: userLocation.lat, lng: userLocation.lng }
          : null
      );
      if (!pickupLocation) {
        setError('Pickup location is not ready. Tap the location button on the map, then choose your destination again.');
        return;
      }

      setIsLoadingRoute(true);
      try {
        const routeInfo = await fetchCyclingRoute(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          place.location
        );
        const fare = calculateFare(routeInfo.distanceKm);
        setPickup(pickupLocation);
        setRoute(routeInfo, fare);
      } catch (err) {
        setError(getRideServiceErrorMessage(err, 'Could not fetch route'));
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [pickup, userLocation, setDestination, setPickup, setRoute, setError]
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
      setRideBids([]);
      setAcceptedBid(null);
      setStatus('waiting');
      setWaitingSeconds(0);

      // Start waiting timer
      waitingInterval.current = setInterval(() => {
        setWaitingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(getRideServiceErrorMessage(err, 'Could not create ride request'));
      setStatus('confirming');
    }
  }, [user, pickup, destination, offerAmount, setStatus, setError, setActiveRequest]);

  const handleRespondToBid = useCallback(async (bid: RideBid, accept: boolean) => {
    setRespondingBidId(bid.id);
    setError(null);
    try {
      await respondToRideBid(bid.id, accept);
    } catch (err) {
      setError(getRideServiceErrorMessage(err, 'Could not respond to this bid.'));
      setRespondingBidId(null);
      return;
    }

    if (accept) {
      setAcceptedBid(bid);
      setStatus('accepted');
      if (waitingInterval.current) {
        clearInterval(waitingInterval.current);
        waitingInterval.current = null;
      }
    }

    try {
      const updatedBids = await getRideBids(bid.rideRequestId);
      setRideBids(updatedBids);
    } catch (err) {
      setError(
        `Your response was saved, but bids could not refresh: ${getRideServiceErrorMessage(
          err,
          'Could not reload bids.'
        )}`
      );
    } finally {
      setRespondingBidId(null);
    }
  }, [setError, setStatus]);

  const handleShareTrip = useCallback(async () => {
    if (!activeRequest) return;
    setSharing(true);
    setShareMessage(null);
    try {
      let share = shareInfo;
      if (!share) {
        const created = await createTripTrackingShare('ride', activeRequest.id);
        share = {
          id: created.id,
          url: created.url,
        };
        setShareInfo(share);
      }
      if (navigator.share) {
        await navigator.share({ title: 'Track my Tugende ride', url: share.url });
      } else {
        await navigator.clipboard.writeText(share.url);
        setShareMessage('Tracking link copied');
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError(getRideServiceErrorMessage(shareError, 'Could not create a tracking link.'));
    } finally {
      setSharing(false);
    }
  }, [activeRequest, shareInfo, setError]);

  const handleRevokeShare = useCallback(async () => {
    if (!shareInfo) return;
    setSharing(true);
    try {
      await revokeTripTrackingShare(shareInfo.id);
      setShareInfo(null);
      setShareMessage('Link stopped');
    } catch (shareError) {
      setError(getRideServiceErrorMessage(shareError, 'Could not stop sharing.'));
    } finally {
      setSharing(false);
    }
  }, [shareInfo, setError]);

  const handleBeginRequest = useCallback(() => {
    setOfferAmount('');
    setError(null);
    setIsSettingOffer(true);
  }, [setError]);

  // Cancel ride request
  const handleCancel = useCallback(async () => {
    if (activeRequest) {
      try {
        await cancelRideRequest(activeRequest.id);
      } catch (err) {
        setError(getRideServiceErrorMessage(err, 'Could not cancel this ride request.'));
        return;
      }
    }

    if (waitingInterval.current) {
      clearInterval(waitingInterval.current);
      waitingInterval.current = null;
    }

    reset();
    setOfferAmount('');
    setIsSettingOffer(false);
    setIsBookingRide(false);
    setRideBids([]);
    setAcceptedBid(null);
    setWaitingSeconds(0);
  }, [activeRequest, reset, setError]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (waitingInterval.current) clearInterval(waitingInterval.current);
    };
  }, []);

  useEffect(() => {
    if (status !== 'waiting' || !activeRequest) return;

    let cancelled = false;
    const refreshBids = async () => {
      try {
        const bids = await getRideBids(activeRequest.id);
        if (!cancelled) {
          setRideBids(bids);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getRideServiceErrorMessage(err, 'Could not load driver bids.'));
        }
      }
    };

    void refreshBids();
    const interval = setInterval(() => void refreshBids(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeRequest, setError, status]);

  useEffect(() => {
    if (!activeRequest || !['accepted', 'in_progress'].includes(status)) return;
    let active = true;
    const refreshTracking = async () => {
      try {
        const current = await getTripTracking('ride', activeRequest.id);
        if (!active) return;
        setTracking(current);
        if (current.status === 'in_progress' || current.status === 'completed') {
          setStatus(current.status);
        }
      } catch (trackingError) {
        if (active) setError(getRideServiceErrorMessage(trackingError, 'Could not load live trip status.'));
      }
    };
    void refreshTracking();
    const interval = window.setInterval(() => void refreshTracking(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeRequest, setError, setStatus, status]);

  const formatWaitTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <PageContainer withPadding={false} className="relative h-dvh !min-h-0">
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
          <h1 className="flex items-center gap-2 text-xl font-bold text-black tracking-tight">
            <img src="/icons/tugende-192.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
            Tugende
          </h1>
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
          destination={status === 'requesting' || status === 'waiting' ? null : destination}
          pickupLocation={status === 'confirming' || status === 'requesting' || status === 'waiting' || status === 'accepted' || status === 'in_progress' ? pickup : null}
          showPickupMarker={status !== 'requesting' && status !== 'waiting'}
          searching={status === 'requesting' || status === 'waiting'}
          routeGeometry={status === 'requesting' || status === 'waiting' ? null : route?.geometry ?? null}
          bikeLocation={tracking?.driverLocation}
          bikeHeading={tracking?.driverLocation?.heading}
          followBikeLocation
        />
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence mode="wait">
        {/* ═══ IDLE STATE ═══ */}
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-10 max-h-[min(78dvh,calc(100dvh-env(safe-area-inset-top)-5rem))] overflow-y-auto overscroll-contain scroll-smooth rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />
            {isBookingRide ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-black">Take a ride</h2>
                  <button
                    type="button"
                    aria-label="Back to home"
                    className="rounded-full p-2 hover:bg-gray-100"
                    onClick={() => {
                      setIsBookingRide(false);
                      setDestination(null);
                      setError(null);
                    }}
                  >
                    <X aria-hidden="true" className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                <DestinationSearch
                  userLocation={userLocation}
                  selectedPlace={destination}
                  onSelect={handleDestinationSelect}
                />
                {destination && status === 'idle' && (
                  <Button
                    fullWidth
                    size="lg"
                    loading={isLoadingRoute}
                    disabled={isLoadingRoute || (!pickup && !userLocation)}
                    onClick={() => void handleDestinationSelect(destination)}
                  >
                    <Navigation aria-hidden="true" className="mr-2 h-5 w-5" />
                    {isLoadingRoute ? 'Calculating route…' : 'Continue'}
                  </Button>
                )}
                {error && <p role="alert" className="text-center text-sm text-red">{error}</p>}
              </>
            ) : (
              <>
                <Button fullWidth size="lg" className="py-4" onClick={() => setIsBookingRide(true)}>
                  <Bike aria-hidden="true" className="mr-2 h-5 w-5" />
                  Take a ride
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  size="lg"
                  className="py-4"
                  onClick={() => navigate('/parcels/new')}
                >
                  <Package aria-hidden="true" className="mr-2 h-5 w-5" />
                  Send a parcel
                </Button>
              </>
            )}
          </motion.div>
        )}

        {/* ═══ CONFIRMING STATE ═══ */}
        {status === 'confirming' && route && destination && (
          <motion.div
            key="confirming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-10 max-h-[min(82dvh,calc(100dvh-env(safe-area-inset-top)-4rem))] overflow-y-auto overscroll-contain scroll-smooth rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-4" />

            {/* Route summary */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight text-black">
                {isSettingOffer ? 'Your offer' : 'Your ride'}
              </h2>
              <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Pickup & Destination */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-gray-500 border-2 border-white shadow" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pickup</p>
                  <p className="text-sm font-semibold text-black truncate">{pickup?.address}</p>
                </div>
              </div>
              <div className="ml-1.5 border-l-2 border-dashed border-gray-200 h-4" />
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-sunset border-2 border-white shadow" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Drop-off</p>
                  <p className="text-sm font-semibold text-black truncate">{destination.name}</p>
                </div>
              </div>
            </div>

            {/* Trip estimate */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Route className="w-4 h-4 text-sunset mx-auto mb-1" />
                <p className="text-base font-bold text-black">{formatDistance(route.distanceKm)}</p>
                <p className="text-xs font-medium text-gray-500">Distance</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-sunset mx-auto mb-1" />
                <p className="text-base font-bold text-black">{formatDuration(route.durationMin)}</p>
                <p className="text-xs font-medium text-gray-500">Time</p>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-sunset/5 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">Est. fare</span>
              <span className="text-lg font-extrabold tracking-tight text-sunset">
                {formatFare(estimatedFare)}
              </span>
            </div>

            {isSettingOffer && (
              <label className="block mb-4">
                <span className="mb-2 block text-sm font-bold text-black">Your offer · RWF</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={offerAmount}
                  onChange={(event) => setOfferAmount(event.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-lg font-semibold text-black outline-none transition focus:border-sunset focus:ring-2 focus:ring-sunset/20"
                  aria-label="Your offer in RWF"
                />
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg"
          >
              <Loader2 className="h-5 w-5 animate-spin text-sunset" />
              <p className="text-sm font-bold tracking-tight text-black">Sending ride request…</p>
          </motion.div>
        )}

        {/* ═══ WAITING STATE ═══ */}
        {(status === 'waiting' || status === 'accepted' || status === 'in_progress' || status === 'completed') && (
          <motion.div
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute left-4 right-4 z-10 max-h-[calc(100dvh-env(safe-area-inset-bottom)-1rem)] overflow-y-auto overscroll-contain scroll-smooth bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg ${
              status === 'waiting'
                ? rideBids.some((bid) => bid.status === 'pending')
                  ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] rounded-3xl p-4'
                  : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] rounded-2xl p-4'
                : 'bottom-0 rounded-t-3xl p-6'
            }`}
          >
            {status !== 'waiting' && (
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-6" />
            )}

            <div className="flex flex-col items-center text-center">
              {status !== 'waiting' && (
                <div className="relative mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-sunset/20 rounded-full"
                    style={{ width: 80, height: 80, top: -10, left: -10 }}
                  />
                  <div className="w-16 h-16 bg-sunset/10 rounded-full flex items-center justify-center relative z-10">
                    <Bike aria-hidden="true" className="h-8 w-8 text-sunset" />
                  </div>
                </div>
              )}

              <h2 className={`font-bold tracking-tight text-black ${status === 'waiting' ? 'text-base' : 'mb-1 text-xl'}`}>
                {status === 'waiting' ? 'Finding a driver…' : status === 'in_progress' ? 'Ride in progress' : status === 'completed' ? 'Ride complete' : 'Ride confirmed'}
              </h2>
              
              {/* Timer */}
              {status !== 'waiting' && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 mt-3 mb-6">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-mono font-bold text-black">
                    {formatWaitTime(waitingSeconds)}
                  </span>
                </div>
              )}

              {/* Ride details summary */}
              {status !== 'waiting' && <div className="w-full bg-gray-50 rounded-2xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-sm font-medium text-gray-700 truncate">{pickup?.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sunset" />
                  <span className="text-sm font-medium text-gray-700 truncate">{destination?.name}</span>
                </div>
                <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between">
                  <span className="text-sm font-semibold text-gray-700">Your offer</span>
                  <span className="text-base font-extrabold text-sunset">
                    {activeRequest?.passengerOffer != null
                      ? formatFare(activeRequest.passengerOffer)
                      : '—'}
                  </span>
                </div>
              </div>}

              {status !== 'waiting' && acceptedBid && (
                <div className="w-full rounded-2xl border border-sunset/20 bg-sunset/5 p-4 mb-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sunset">Driver</p>
                  <p className="mt-1 text-lg font-bold tracking-tight text-black">{acceptedBid.driverName}</p>
                  {acceptedBid.bicycleNumber && (
                    <p className="text-sm text-gray-600">Bicycle {acceptedBid.bicycleNumber}</p>
                  )}
                  <p className="mt-2 text-sm font-semibold text-sunset">
                    Agreed fare: {formatFare(acceptedBid.proposedFare)}
                  </p>
                </div>
              )}

              {status !== 'waiting' && (
                <div className="mb-4 w-full space-y-2">
                  {status !== 'completed' && (
                    <>
                      <p className="text-sm font-medium text-gray-600">
                        {tracking?.driverLocation ? 'Driver is on the way' : 'Waiting for driver to start'}
                      </p>
                      <Button fullWidth loading={sharing} onClick={() => void handleShareTrip()}>
                        <Share2 aria-hidden="true" className="mr-2 h-4 w-4" />
                        Share trip
                      </Button>
                    </>
                  )}
                  {shareInfo && (
                    <Button variant="outline" disabled={sharing} onClick={() => void handleRevokeShare()}>
                      Stop sharing
                    </Button>
                  )}
                  {shareMessage && <p className="text-sm text-gray-600">{shareMessage}</p>}
                </div>
              )}

              {status === 'waiting' && (
                <div className="w-full mb-5 text-left">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-black">Driver bids</h3>
                    <span className="text-xs font-medium text-gray-500">{rideBids.length}</span>
                  </div>
                  {rideBids.filter((bid) => bid.status === 'pending').length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600">
                      Searching nearby
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {rideBids.filter((bid) => bid.status === 'pending').map((bid) => (
                        <div key={bid.id} className="rounded-xl border border-gray-100 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-black">{bid.driverName}</p>
                              {bid.bicycleNumber && (
                                <p className="text-xs text-gray-500">Bicycle {bid.bicycleNumber}</p>
                              )}
                            </div>
                            <p className="font-bold text-sunset">{formatFare(bid.proposedFare)}</p>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="ghost"
                              disabled={respondingBidId !== null}
                              onClick={() => void handleRespondToBid(bid, false)}
                              className="flex-1"
                            >
                              Decline
                            </Button>
                            <Button
                              disabled={respondingBidId !== null}
                              onClick={() => void handleRespondToBid(bid, true)}
                              className="flex-1"
                            >
                              Accept bid
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="mb-3 w-full text-sm text-red">{error}</p>}

              {status === 'waiting' && (
                <Button variant="ghost" fullWidth onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" /> Cancel Request
                </Button>
              )}
              {status === 'completed' && (
                <Button
                  fullWidth
                  onClick={() => {
                    reset();
                    setTracking(null);
                    setShareInfo(null);
                    setShareMessage(null);
                    setAcceptedBid(null);
                  }}
                >
                  Done
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
