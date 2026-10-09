import { useState, useCallback, useEffect, useRef } from 'react';
import { Bike, MapPin, Package, Route, Search } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import MapView from '../../components/map/MapView';
import MapSettings from '../../components/map/MapSettings';
import { useAuthStore } from '../../store/authStore';
import {
  getNearbyParcelDeliveries,
  getNearbyRideRequests,
  getDriverActiveTrips,
  getRideServiceErrorMessage,
  publishTripLocation,
  setTripStatus,
  submitParcelBid,
  submitRideBid,
} from '../../services/rideService';
import { formatDistance, formatFare } from '../../utils/fareCalculator';
import type { DriverActiveTrip, NearbyParcelDelivery, NearbyRideRequest } from '../../types';

function getDevicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(() => reject(
        new Error(
          'Location permission is enabled, but your device has not provided a location fix. Turn on Location Services/GPS and try again.'
        )
      ));
    }, 45_000);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      callback();
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => finish(() => resolve(position)),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(() => reject(new Error('Location permission is blocked. Allow location access in your browser settings.')));
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 }
    );
  });
}

export default function DriverHome() {
  const [isOnline, setIsOnline] = useState(false);
  const { user } = useAuthStore();
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    heading?: number | null;
  } | null>(null);
  const driverLocationRef = useRef<{ lat: number; lng: number; heading?: number | null } | null>(null);
  const [rideRequests, setRideRequests] = useState<NearbyRideRequest[]>([]);
  const [parcelDeliveries, setParcelDeliveries] = useState<NearbyParcelDelivery[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [activeTrips, setActiveTrips] = useState<DriverActiveTrip[]>([]);
  const [trackingActionId, setTrackingActionId] = useState<string | null>(null);
  const lastPublishedAt = useRef<number | null>(null);

  const handleMapReady = useCallback((map: MapboxMap) => {
    setMapInstance(map);
  }, []);

  const handleLocationFound = useCallback((location: { lat: number; lng: number; heading?: number | null }) => {
    driverLocationRef.current = location;
    setDriverLocation(location);
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const refreshActiveTrips = async () => {
      try {
        const trips = await getDriverActiveTrips();
        if (isMounted) {
          setActiveTrips((current) => {
            const unchanged =
              current.length === trips.length &&
              current.every((trip, index) =>
                trip.id === trips[index]?.id &&
                trip.type === trips[index]?.type &&
                trip.status === trips[index]?.status &&
                trip.agreedFare === trips[index]?.agreedFare
              );
            return unchanged ? current : trips;
          });
        }
      } catch (err) {
        if (isMounted) {
          setBidError(getRideServiceErrorMessage(err, 'Could not load your accepted trips.'));
        }
      }
    };

    void refreshActiveTrips();
    const interval = window.setInterval(() => void refreshActiveTrips(), 5000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const tripsInProgress = activeTrips.filter((trip) => trip.status === 'in_progress');
    if (!tripsInProgress.length || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
        };
        const now = Date.now();
        if (lastPublishedAt.current !== null && now - lastPublishedAt.current < 5000) return;
        lastPublishedAt.current = now;
        handleLocationFound(location);
        void Promise.all(
          tripsInProgress.map((trip) => publishTripLocation(trip.type, trip.id, location))
        ).catch((err: unknown) => {
          setBidError(getRideServiceErrorMessage(err, 'Could not update live location.'));
        });
      },
      (error) => setBidError(`Live location stopped: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrips, handleLocationFound]);

  useEffect(() => {
    if (!isOnline) return;

    let isMounted = true;
    const refreshRideRequests = async () => {
      const location = driverLocationRef.current;
      if (!location) return;
      setLoadingRequests(true);
      try {
        const [requests, parcels] = await Promise.all([
          getNearbyRideRequests(location),
          getNearbyParcelDeliveries(location),
        ]);
        if (isMounted) {
          setRideRequests(requests);
          setParcelDeliveries(parcels);
          setBidError(null);
        }
      } catch (err) {
        if (isMounted) {
          setBidError(getRideServiceErrorMessage(err, 'Could not load nearby ride requests.'));
        }
      } finally {
        if (isMounted) setLoadingRequests(false);
      }
    };

    void refreshRideRequests();
    const interval = setInterval(() => void refreshRideRequests(), 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOnline]);

  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    if (newStatus && !driverLocation) {
      if (!navigator.geolocation) {
        setBidError('This device does not support location access.');
        return;
      }

      setGettingLocation(true);
      void getDevicePosition()
        .then((position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          handleLocationFound(location);
          setIsOnline(true);
          setBidError(null);
          mapInstance?.easeTo({ zoom: 15, duration: 500 });
        })
        .catch((error: unknown) => {
          setBidError(getRideServiceErrorMessage(error, 'Could not get your location.'));
        })
        .finally(() => setGettingLocation(false));
      return;
    }
    setIsOnline(newStatus);
    if (!newStatus) {
      setRideRequests([]);
      setParcelDeliveries([]);
    }
    setBidError(null);

    // Visual feedback: change map style when going online
    if (mapInstance) {
      mapInstance.easeTo({
        zoom: newStatus ? 15 : 14,
        duration: 500,
      });
    }
  };

  const handleTripAction = async (trip: DriverActiveTrip) => {
    setTrackingActionId(trip.id);
    setBidError(null);
    try {
      if (trip.status === 'accepted') {
        if (!navigator.geolocation) {
          throw new Error('This device does not support location sharing.');
        }
        const position = await getDevicePosition();
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
        };
        handleLocationFound(location);
        await setTripStatus(trip.type, trip.id, 'in_progress');
        await publishTripLocation(trip.type, trip.id, location);
      } else {
        await setTripStatus(trip.type, trip.id, 'completed');
      }
      setActiveTrips(await getDriverActiveTrips());
    } catch (err) {
      setBidError(getRideServiceErrorMessage(err, 'Could not update this trip.'));
    } finally {
      setTrackingActionId(null);
    }
  };

  const handleSubmitBid = async (request: NearbyRideRequest) => {
    const proposedFare = Number(bidAmount);
    const location = driverLocationRef.current;
    if (!user || !location || !Number.isSafeInteger(proposedFare) || proposedFare <= 0) {
      setBidError('Enter a valid bid greater than 0 RWF.');
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    try {
      await submitRideBid(request.id, user.id, proposedFare);
      setSelectedRequestId(null);
      setBidAmount('');
    } catch (err) {
      setBidError(getRideServiceErrorMessage(err, 'Could not submit your bid.'));
      setSubmittingBid(false);
      return;
    }

    try {
      const updatedRequests = await getNearbyRideRequests(location);
      setRideRequests(updatedRequests);
    } catch (err) {
      setBidError(
        `Your bid was submitted, but nearby requests could not refresh: ${getRideServiceErrorMessage(
          err,
          'Could not refresh nearby requests.'
        )}`
      );
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSubmitParcelBid = async (delivery: NearbyParcelDelivery) => {
    const proposedFare = Number(bidAmount);
    const location = driverLocationRef.current;
    if (!user || !location || !Number.isSafeInteger(proposedFare) || proposedFare <= 0) {
      setBidError('Enter a valid bid greater than 0 RWF.');
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    try {
      await submitParcelBid(delivery.id, user.id, proposedFare);
      setSelectedParcelId(null);
      setBidAmount('');
    } catch (err) {
      setBidError(getRideServiceErrorMessage(err, 'Could not submit your parcel bid.'));
      setSubmittingBid(false);
      return;
    }

    try {
      setParcelDeliveries(await getNearbyParcelDeliveries(location));
    } catch (err) {
      setBidError(
        `Your bid was submitted, but parcel requests could not refresh: ${getRideServiceErrorMessage(
          err,
          'Could not refresh parcel requests.'
        )}`
      );
    } finally {
      setSubmittingBid(false);
    }
  };

  return (
    <PageContainer withPadding={false} className="relative h-screen !min-h-0">
      {/* Header — floats over the map */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-center z-10">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
          <h1 className="text-lg font-bold text-black tracking-tight">
            <img
              src="/icons/tugende-192.png"
              alt=""
              className="mr-1 inline h-6 w-6 rounded-md object-cover align-text-bottom"
            />
            {user?.name || 'Driver'}
          </h1>
        </div>

        {/* Online/Offline Toggle */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleOnline}
            disabled={gettingLocation}
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 disabled:opacity-70 ${
              isOnline 
                ? 'bg-sunset text-white' 
                : 'bg-white text-gray-500'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm font-semibold">
              {gettingLocation ? 'Getting location…' : isOnline ? 'Online' : 'Offline'}
            </span>
          </button>
          <MapSettings />
        </div>
      </div>

      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <MapView
          showUserLocation
          bikeLocation={driverLocation}
          bikeHeading={driverLocation?.heading}
          onMapReady={handleMapReady}
          onLocationFound={handleLocationFound}
        />
      </div>

      {/* Bottom Section — floats over the map */}
      <div className="absolute bottom-0 left-0 right-0 max-h-[55vh] overflow-y-auto bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 z-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-4 sticky top-0" />

        {activeTrips.length > 0 && (
          <div className="mb-4 space-y-3">
            <h2 className="text-base font-bold text-black">Your accepted trips</h2>
            {activeTrips.map((trip) => (
              <div key={`${trip.type}-${trip.id}`} className="rounded-2xl border border-sunset/20 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-bold text-black">
                    {trip.type === 'ride' ? 'Passenger ride' : 'Parcel delivery'}
                  </span>
                  <span className="text-sm font-extrabold text-sunset">{formatFare(trip.agreedFare)}</span>
                </div>
                <p className="truncate text-sm text-gray-700">{trip.pickup.address}</p>
                <p className="my-1 text-xs font-semibold uppercase text-gray-400">to</p>
                <p className="truncate text-sm text-gray-700">{trip.destination.address}</p>
                <Button
                  fullWidth
                  className="mt-3"
                  loading={trackingActionId === trip.id}
                  onClick={() => void handleTripAction(trip)}
                >
                  {trip.status === 'accepted' ? 'Start trip' : 'Complete trip'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {isOnline ? (
          <div className="flex flex-col gap-3">
            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sunset animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">Searching nearby</span>
            </div>
            
            {bidError && <p role="alert" className="text-sm text-red text-center">{bidError}</p>}

            {loadingRequests && rideRequests.length === 0 && parcelDeliveries.length === 0 ? (
              <p className="py-5 text-center text-sm text-gray-500">Searching nearby requests…</p>
            ) : rideRequests.length === 0 && parcelDeliveries.length === 0 ? (
              <div className="w-full bg-gray-50 rounded-2xl p-6 flex flex-col items-center gap-3 border border-gray-100">
                <Search aria-hidden="true" className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
                <p className="text-gray-600 font-medium text-sm text-center">
                  No nearby requests
                </p>
              </div>
            ) : (
              <>
                {rideRequests.length > 0 && (
                  <div className="space-y-3">
                    {rideRequests.map((request) => {
                  const isSelected = selectedRequestId === request.id;
                  return (
                    <div key={request.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600">
                          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                          {formatDistance(request.pickupDistanceMeters / 1000)} away
                        </span>
                        <span className="text-base font-extrabold tracking-tight text-sunset">
                          Offer {formatFare(request.passengerOffer)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-start gap-2 text-gray-700">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-500" />
                          <span className="truncate">{request.pickup.address}</span>
                        </p>
                        <p className="flex items-start gap-2 text-gray-700">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sunset" />
                          <span className="truncate">{request.destination.address}</span>
                        </p>
                        {request.driverBid !== undefined ? (
                          <p className="mt-3 rounded-lg bg-sunset/5 px-3 py-2 text-sm font-semibold text-sunset">
                            Your bid: {formatFare(request.driverBid)}
                          </p>
                        ) : isSelected ? (
                          <div className="mt-3 space-y-2">
                            <label className="block text-sm font-bold text-gray-700">
                              Your bid · RWF
                              <input
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={bidAmount}
                                onChange={(event) => setBidAmount(event.target.value)}
                                placeholder="Amount"
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-lg font-semibold text-black outline-none transition focus:border-sunset focus:ring-2 focus:ring-sunset/20"
                              />
                            </label>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setSelectedRequestId(null);
                                  setBidAmount('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                fullWidth
                                disabled={!Number.isSafeInteger(Number(bidAmount)) || Number(bidAmount) <= 0}
                                loading={submittingBid}
                                onClick={() => void handleSubmitBid(request)}
                              >
                                Submit bid
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            fullWidth
                            className="mt-3"
                            onClick={() => {
                              setSelectedRequestId(request.id);
                              setSelectedParcelId(null);
                              setBidAmount('');
                              setBidError(null);
                            }}
                          >
                            <Route aria-hidden="true" className="mr-2 h-4 w-4" />
                            Bid
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                    })}
                  </div>
                )}
                {parcelDeliveries.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="pt-2 text-base font-bold text-black">Parcel deliveries</h2>
                    {parcelDeliveries.map((delivery) => {
                      const isSelected = selectedParcelId === delivery.id;
                      return (
                        <div key={delivery.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600">
                              <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                              {formatDistance(delivery.pickupDistanceMeters / 1000)} away
                            </span>
                            <span className="text-base font-extrabold tracking-tight text-sunset">
                              Offer {formatFare(delivery.senderOffer)}
                            </span>
                          </div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Parcel</p>
                          <div className="space-y-2 text-sm">
                            <p className="flex items-start gap-2 text-gray-700">
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-500" />
                              <span className="truncate">{delivery.pickup.address}</span>
                            </p>
                            <p className="flex items-start gap-2 text-gray-700">
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sunset" />
                              <span className="truncate">{delivery.destination.address}</span>
                            </p>
                            {delivery.driverBid !== undefined ? (
                              <p className="mt-3 rounded-lg bg-sunset/5 px-3 py-2 text-sm font-semibold text-sunset">
                                Your bid: {formatFare(delivery.driverBid)}
                              </p>
                            ) : isSelected ? (
                              <div className="mt-3 space-y-2">
                                <label className="block text-sm font-bold text-gray-700">
                                  Your bid · RWF
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    value={bidAmount}
                                    onChange={(event) => setBidAmount(event.target.value)}
                                    placeholder="Amount"
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-lg font-semibold text-black outline-none transition focus:border-sunset focus:ring-2 focus:ring-sunset/20"
                                  />
                                </label>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedParcelId(null);
                                      setBidAmount('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    fullWidth
                                    disabled={!Number.isSafeInteger(Number(bidAmount)) || Number(bidAmount) <= 0}
                                    loading={submittingBid}
                                    onClick={() => void handleSubmitParcelBid(delivery)}
                                  >
                                    Submit bid
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                fullWidth
                                className="mt-3"
                                onClick={() => {
                                  setSelectedParcelId(delivery.id);
                                  setSelectedRequestId(null);
                                  setBidAmount('');
                                  setBidError(null);
                                }}
                              >
                                <Package aria-hidden="true" className="mr-2 h-4 w-4" />
                                Bid on delivery
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Bike aria-hidden="true" className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
            <p className="text-gray-700 font-semibold text-center">
              Go <span className="text-sunset font-bold">online</span>
            </p>
            {bidError && <p role="alert" className="text-sm text-red text-center">{bidError}</p>}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
