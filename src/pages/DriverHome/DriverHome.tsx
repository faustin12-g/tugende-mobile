import { useState, useCallback, useEffect, useRef } from 'react';
import { Bike, MapPin, Route, Search } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import MapView from '../../components/map/MapView';
import MapSettings from '../../components/map/MapSettings';
import { useAuthStore } from '../../store/authStore';
import {
  getNearbyRideRequests,
  getRideServiceErrorMessage,
  submitRideBid,
} from '../../services/rideService';
import { formatDistance, formatFare } from '../../utils/fareCalculator';
import type { NearbyRideRequest } from '../../types';

export default function DriverHome() {
  const [isOnline, setIsOnline] = useState(false);
  const { user } = useAuthStore();
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [rideRequests, setRideRequests] = useState<NearbyRideRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleMapReady = useCallback((map: MapboxMap) => {
    setMapInstance(map);
  }, []);

  const handleLocationFound = useCallback((location: { lat: number; lng: number }) => {
    driverLocationRef.current = location;
    setDriverLocation(location);
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    let isMounted = true;
    const refreshRideRequests = async () => {
      const location = driverLocationRef.current;
      if (!location) return;
      setLoadingRequests(true);
      try {
        const requests = await getNearbyRideRequests(location);
        if (isMounted) {
          setRideRequests(requests);
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
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          handleLocationFound(location);
          setGettingLocation(false);
          setIsOnline(true);
          setBidError(null);
          mapInstance?.easeTo({ zoom: 15, duration: 500 });
        },
        (error) => {
          setGettingLocation(false);
          setBidError(`Could not get your location: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
      return;
    }
    setIsOnline(newStatus);
    if (!newStatus) setRideRequests([]);
    setBidError(null);

    // Visual feedback: change map style when going online
    if (mapInstance) {
      mapInstance.easeTo({
        zoom: newStatus ? 15 : 14,
        duration: 500,
      });
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

  return (
    <PageContainer withPadding={false} className="relative h-screen !min-h-0">
      {/* Header — floats over the map */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-center z-10">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
          <h1 className="text-lg font-bold text-black tracking-tight">
            <Bike aria-hidden="true" className="mr-1 inline h-5 w-5 align-text-bottom" />
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
          onMapReady={handleMapReady}
          onLocationFound={handleLocationFound}
        />
      </div>

      {/* Bottom Section — floats over the map */}
      <div className="absolute bottom-0 left-0 right-0 max-h-[55vh] overflow-y-auto bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 z-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-4 sticky top-0" />

        {isOnline ? (
          <div className="flex flex-col gap-3">
            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sunset animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">Searching nearby</span>
            </div>
            
            {bidError && <p role="alert" className="text-sm text-red text-center">{bidError}</p>}

            {loadingRequests && rideRequests.length === 0 ? (
              <p className="py-5 text-center text-sm text-gray-500">Searching nearby requests…</p>
            ) : rideRequests.length === 0 ? (
              <div className="w-full bg-gray-50 rounded-2xl p-6 flex flex-col items-center gap-3 border border-gray-100">
                <Search aria-hidden="true" className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
                <p className="text-gray-600 font-medium text-sm text-center">
                  No nearby requests
                </p>
              </div>
            ) : (
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
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                          <span className="truncate">{request.pickup.address}</span>
                        </p>
                        <p className="flex items-start gap-2 text-gray-700">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sunset" />
                          <span className="truncate">{request.destination.address}</span>
                        </p>
                        {request.driverBid !== undefined ? (
                          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
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
