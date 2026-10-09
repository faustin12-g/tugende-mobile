import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Clock, Loader2, MapPin, Package, Route, Share2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import DestinationSearch from '../../components/map/DestinationSearch';
import MapSettings from '../../components/map/MapSettings';
import MapView from '../../components/map/MapView';
import { PageContainer } from '../../components/ui/PageContainer';
import { useAuthStore } from '../../store/authStore';
import {
  cancelParcelDelivery,
  createParcelDelivery,
  getParcelBids,
  getRideServiceErrorMessage,
  getTripTracking,
  createTripTrackingShare,
  revokeTripTrackingShare,
  respondToParcelBid,
} from '../../services/rideService';
import { fetchCyclingRoute, type RouteInfo } from '../../services/directions';
import { calculateFare, formatDistance, formatDuration, formatFare } from '../../utils/fareCalculator';
import type { ParcelBid, TripTracking } from '../../types';
import type { PlaceSelection } from '../../services/googlePlaces';

type PickupMode = 'current' | 'custom';
type ParcelStep = 'details' | 'offer' | 'requesting' | 'waiting' | 'accepted' | 'in_progress' | 'completed';
type Pickup = { address: string; lat: number; lng: number };

export default function ParcelDeliveryScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = useState<ParcelStep>('details');
  const [pickupMode, setPickupMode] = useState<PickupMode>('current');
  const [userLocation, setUserLocation] = useState<Pickup | null>(null);
  const [pickupPlace, setPickupPlace] = useState<PlaceSelection | null>(null);
  const [destination, setDestination] = useState<PlaceSelection | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [senderName, setSenderName] = useState(user?.name ?? '');
  const [senderPhone, setSenderPhone] = useState(user?.phone ?? '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [parcelBids, setParcelBids] = useState<ParcelBid[]>([]);
  const [acceptedBid, setAcceptedBid] = useState<ParcelBid | null>(null);
  const [respondingBid, setRespondingBid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [shareInfo, setShareInfo] = useState<{ id: string; url: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const pickup: Pickup | null =
    pickupMode === 'current'
      ? userLocation
      : pickupPlace
        ? {
            address: pickupPlace.address,
            lat: pickupPlace.location.lat,
            lng: pickupPlace.location.lng,
          }
        : null;

  const handleLocationFound = useCallback((location: { lat: number; lng: number }) => {
    setUserLocation({ address: 'Current location', ...location });
  }, []);

  const chooseCurrentLocation = () => {
    setPickupMode('current');
    setError(null);
    if (userLocation) return;
    if (!navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          address: 'Current location',
          lat: coords.latitude,
          lng: coords.longitude,
        });
        setLoading(false);
      },
      (locationError) => {
        setError(`Could not get your location: ${locationError.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleContinue = async () => {
    if (!pickup || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const routeInfo = await fetchCyclingRoute(pickup, destination.location);
      setRoute(routeInfo);
      setOfferAmount(String(calculateFare(routeInfo.distanceKm)));
      setStep('offer');
    } catch (routeError) {
      setError(getRideServiceErrorMessage(routeError, 'Could not calculate delivery route.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendParcel = async () => {
    if (!user || !pickup || !destination || !route) return;
    const senderOffer = Number(offerAmount);
    if (!Number.isSafeInteger(senderOffer) || senderOffer <= 0) {
      setError('Enter a valid delivery offer.');
      return;
    }

    setStep('requesting');
    setError(null);
    try {
      const delivery = await createParcelDelivery({
        senderId: user.id,
        pickup,
        destination: {
          address: destination.address,
          lat: destination.location.lat,
          lng: destination.location.lng,
        },
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        senderOffer,
      });
      setDeliveryId(delivery.id);
      setStep('waiting');
    } catch (requestError) {
      setError(getRideServiceErrorMessage(requestError, 'Could not create parcel delivery.'));
      setStep('offer');
    }
  };

  const handleBidResponse = async (bid: ParcelBid, accept: boolean) => {
    setRespondingBid(true);
    setError(null);
    try {
      await respondToParcelBid(bid.id, accept);
      const bids = await getParcelBids(bid.parcelDeliveryId);
      setParcelBids(bids);
      if (accept) {
        setAcceptedBid(bid);
        setStep('accepted');
      }
    } catch (bidError) {
      setError(getRideServiceErrorMessage(bidError, 'Could not respond to this bid.'));
    } finally {
      setRespondingBid(false);
    }
  };

  const handleShareTrip = async () => {
    if (!deliveryId) return;
    setSharing(true);
    setShareMessage(null);
    try {
      let share = shareInfo;
      if (!share) {
        const created = await createTripTrackingShare('parcel', deliveryId);
        share = {
          id: created.id,
          url: created.url,
        };
        setShareInfo(share);
      }
      if (navigator.share) {
        await navigator.share({ title: 'Track my Tugende delivery', url: share.url });
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
  };

  const handleRevokeShare = async () => {
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
  };

  const handleCancel = async () => {
    if (deliveryId) {
      setLoading(true);
      try {
        await cancelParcelDelivery(deliveryId);
      } catch (cancelError) {
        setError(getRideServiceErrorMessage(cancelError, 'Could not cancel this delivery.'));
        setLoading(false);
        return;
      }
    }
    navigate('/home');
  };

  useEffect(() => {
    if (!deliveryId || step !== 'waiting') return;
    let active = true;

    const refreshBids = async () => {
      try {
        const bids = await getParcelBids(deliveryId);
        if (active) {
          setParcelBids(bids);
          setError(null);
        }
      } catch (bidError) {
        if (active) setError(getRideServiceErrorMessage(bidError, 'Could not load driver bids.'));
      }
    };

    void refreshBids();
    const interval = window.setInterval(() => void refreshBids(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deliveryId, step]);

  useEffect(() => {
    if (!deliveryId || !['accepted', 'in_progress'].includes(step)) return;
    let active = true;
    const refreshTracking = async () => {
      try {
        const current = await getTripTracking('parcel', deliveryId);
        if (!active) return;
        setTracking(current);
        if (current.status === 'in_progress' || current.status === 'completed') {
          setStep(current.status);
        }
      } catch (trackingError) {
        if (active) setError(getRideServiceErrorMessage(trackingError, 'Could not load live delivery status.'));
      }
    };
    void refreshTracking();
    const interval = window.setInterval(() => void refreshTracking(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deliveryId, step]);

  const detailsValid =
    Boolean(pickup && destination) &&
    senderName.trim().length > 0 &&
    senderPhone.trim().length >= 7 &&
    recipientName.trim().length > 0 &&
    recipientPhone.trim().length >= 7;
  const offerValid = Number.isSafeInteger(Number(offerAmount)) && Number(offerAmount) > 0;
  const pendingParcelBids = parcelBids.filter((bid) => bid.status === 'pending');
  const isParcelRequestActive = step === 'requesting' || step === 'waiting';

  return (
    <PageContainer withPadding={false} className="relative h-dvh !min-h-0">
      <div className="absolute inset-0">
        <MapView
          showUserLocation
          onLocationFound={handleLocationFound}
          destination={isParcelRequestActive ? null : destination}
          pickupLocation={pickup}
          showPickupMarker={!isParcelRequestActive}
          routeGeometry={isParcelRequestActive ? null : route?.geometry ?? null}
          searching={step === 'requesting' || step === 'waiting'}
          bikeLocation={tracking?.driverLocation}
          bikeHeading={tracking?.driverLocation?.heading}
          followBikeLocation
        />
      </div>

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          type="button"
          onClick={() => (step === 'offer' ? setStep('details') : navigate('/home'))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg"
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5 text-black" />
        </button>
        <h1 className="rounded-2xl bg-white/95 px-4 py-2 text-base font-bold text-black shadow-lg">
          Send parcel
        </h1>
        <MapSettings />
      </header>

      <section
        style={{ maxHeight: 'min(78dvh, calc(100dvh - env(safe-area-inset-top) - 5rem))' }}
        className={`absolute z-10 overflow-y-auto overscroll-contain scroll-smooth bg-white pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-lg ${
        step === 'details' || step === 'offer'
          ? 'bottom-0 left-0 right-0 rounded-t-3xl p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]'
          : step === 'waiting' && pendingParcelBids.length > 0
            ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 rounded-3xl p-4'
            : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 rounded-2xl p-4'
      }`}>
        {(step === 'details' || step === 'offer') && (
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package aria-hidden="true" className="h-5 w-5 text-sunset" />
              <h2 className="text-xl font-bold tracking-tight text-black">Delivery details</h2>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-gray-700">Pickup</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={chooseCurrentLocation}
                  disabled={loading}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-70 ${
                    pickupMode === 'current' && userLocation
                      ? 'border-sunset bg-sunset/5 text-sunset'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {loading ? 'Locating…' : userLocation ? 'Use my location' : 'Get my location'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickupMode('custom');
                    setRoute(null);
                    setError(null);
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    pickupMode === 'custom'
                      ? 'border-sunset bg-sunset/5 text-sunset'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Choose pickup
                </button>
              </div>
              {pickupMode === 'current' ? (
                <>
                  <p className="mt-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-700">
                    <MapPin aria-hidden="true" className="h-4 w-4 text-sunset" />
                    {userLocation?.address ?? (loading ? 'Finding location…' : 'Tap “My location”')}
                  </p>
                  {!userLocation && !loading && (
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      If location isn’t available, choose a pickup address instead.
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2">
                  <DestinationSearch
                    userLocation={userLocation}
                    selectedPlace={pickupPlace}
                    onSelect={(place) => {
                      setPickupPlace(place);
                      setError(null);
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-gray-700">Deliver to</p>
              <DestinationSearch
                userLocation={userLocation}
                selectedPlace={destination}
                onSelect={(place) => {
                  setDestination(place);
                  setRoute(null);
                  setError(null);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Sender"
                autoComplete="name"
                placeholder="Your name"
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
              />
              <Input
                label="Sender phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone"
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
              />
              <Input
                label="Recipient"
                autoComplete="name"
                placeholder="Name"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
              <Input
                label="Recipient phone"
                type="tel"
                inputMode="tel"
                placeholder="Phone"
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
              />
            </div>

            {error && <p role="alert" className="text-sm font-medium text-red">{error}</p>}
            <Button
              fullWidth
              size="lg"
              loading={loading}
              disabled={!detailsValid}
              onClick={() => void handleContinue()}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 'offer' && route && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-black">Delivery offer</h2>
              <button
                type="button"
                onClick={() => setStep('details')}
                aria-label="Edit delivery details"
                className="rounded-full p-2 hover:bg-gray-100"
              >
                <X aria-hidden="true" className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-sm">
              <p className="truncate text-gray-700">
                <span className="font-bold text-black">Pickup</span> · {pickup?.address}
              </p>
              <p className="truncate text-gray-700">
                <span className="font-bold text-black">Drop-off</span> · {destination?.address}
              </p>
              <p className="truncate border-t border-gray-200 pt-2 text-gray-700">
                {senderName} · {senderPhone} <span className="text-sunset">→</span>{' '}
                {recipientName} · {recipientPhone}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <Route aria-hidden="true" className="mx-auto mb-1 h-4 w-4 text-sunset" />
                <p className="font-bold text-black">{formatDistance(route.distanceKm)}</p>
                <p className="text-xs font-medium text-gray-500">Distance</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <Clock aria-hidden="true" className="mx-auto mb-1 h-4 w-4 text-sunset" />
                <p className="font-bold text-black">{formatDuration(route.durationMin)}</p>
                <p className="text-xs font-medium text-gray-500">Time</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-sunset/5 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">Est. delivery</span>
              <span className="text-lg font-extrabold text-sunset">
                {formatFare(calculateFare(route.distanceKm))}
              </span>
            </div>

            <Input
              label="Your offer · RWF"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Amount"
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value)}
            />
            {error && <p role="alert" className="text-sm font-medium text-red">{error}</p>}
            <Button
              fullWidth
              size="lg"
              loading={loading}
              disabled={!offerValid}
              onClick={() => void handleSendParcel()}
            >
              <Package aria-hidden="true" className="mr-2 h-5 w-5" />
              Find a rider
            </Button>
          </div>
        )}

        {step === 'requesting' && (
          <div className="flex items-center gap-3">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-sunset" />
            <h2 className="text-base font-bold text-black">Sending parcel request…</h2>
          </div>
        )}

        {step === 'waiting' && (
          <div className="space-y-3">
            {pendingParcelBids.length === 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sunset" />
                  <h2 className="font-bold text-black">Finding a rider…</h2>
                </div>
                <p className="text-sm font-medium text-gray-600">Your request is on the map</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-black">Rider bids</h2>
                  <span className="rounded-full bg-sunset/10 px-3 py-1 text-sm font-bold text-sunset">
                    {pendingParcelBids.length}
                  </span>
                </div>
                {pendingParcelBids.map((bid) => (
                  <div key={bid.id} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-black">{bid.driverName}</span>
                      <span className="font-extrabold text-sunset">{formatFare(bid.proposedFare)}</span>
                    </div>
                    {bid.bicycleNumber && (
                      <p className="mt-1 text-sm text-gray-600">Bicycle {bid.bicycleNumber}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        disabled={respondingBid}
                        onClick={() => void handleBidResponse(bid, false)}
                        className="flex-1"
                      >
                        Decline
                      </Button>
                      <Button
                        disabled={respondingBid}
                        onClick={() => void handleBidResponse(bid, true)}
                        className="flex-1"
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {error && <p role="alert" className="text-sm font-medium text-red">{error}</p>}
            <Button variant="ghost" fullWidth loading={loading} onClick={() => void handleCancel()}>
              <X aria-hidden="true" className="mr-2 h-4 w-4" />
              Cancel request
            </Button>
          </div>
        )}

        {(step === 'accepted' || step === 'in_progress' || step === 'completed') && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sunset/10">
                <Bike aria-hidden="true" className="h-6 w-6 text-sunset" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-black">
                  {step === 'in_progress' ? 'Delivery in progress' : step === 'completed' ? 'Delivery complete' : 'Delivery confirmed'}
                </h2>
                {acceptedBid && (
                  <p className="text-sm font-semibold text-sunset">
                    {acceptedBid.driverName} · {formatFare(acceptedBid.proposedFare)}
                  </p>
                )}
              </div>
            </div>

            {error && <p role="alert" className="text-sm font-medium text-red">{error}</p>}
            {step !== 'completed' && (
              <>
                <p className="text-sm font-medium text-gray-600">
                  {tracking?.driverLocation ? 'Driver is on the way' : 'Waiting for driver to start'}
                </p>
                <Button fullWidth loading={sharing} onClick={() => void handleShareTrip()}>
                  <Share2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Share delivery
                </Button>
              </>
            )}
            {shareInfo && (
              <Button variant="outline" disabled={sharing} onClick={() => void handleRevokeShare()}>
                Stop sharing
              </Button>
            )}
            {shareMessage && <p className="text-sm text-gray-600">{shareMessage}</p>}
            {step === 'completed' && (
              <Button fullWidth onClick={() => navigate('/home')}>Done</Button>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
