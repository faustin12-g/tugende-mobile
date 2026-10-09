import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bike, Loader2, MapPin, Package } from 'lucide-react';
import MapView from '../../components/map/MapView';
import { getPublicTripTracking, getRideServiceErrorMessage } from '../../services/rideService';
import type { TripTracking } from '../../types';

export default function PublicTrackingScreen() {
  const { token } = useParams<{ token: string }>();
  const [tracking, setTracking] = useState<TripTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pickupLat = tracking?.pickup.lat;
  const pickupLng = tracking?.pickup.lng;
  const center = useMemo<[number, number] | undefined>(
    () => (pickupLat !== undefined && pickupLng !== undefined ? [pickupLng, pickupLat] : undefined),
    [pickupLat, pickupLng]
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    const refresh = async () => {
      try {
        const current = await getPublicTripTracking(token);
        if (!active) return;
        if (!current) {
          setTracking(null);
          setError('This tracking link has expired or been stopped.');
          return;
        }
        setTracking(current);
        setError(null);
      } catch (trackingError) {
        if (active) setError(getRideServiceErrorMessage(trackingError, 'Could not load trip tracking.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token]);

  const isComplete = tracking?.status === 'completed';
  const isMoving = tracking?.status === 'in_progress';

  return (
    <main className="relative h-screen min-h-0 bg-gray-100">
      <div className="absolute inset-0">
        {tracking && (
          <MapView
            center={center}
            zoom={14}
            showUserLocation={false}
            pickupLocation={tracking.pickup}
            destination={{
              id: `tracking-${tracking.id}`,
              name: tracking.destination.address,
              address: tracking.destination.address,
              location: { lat: tracking.destination.lat, lng: tracking.destination.lng },
            }}
            bikeLocation={tracking.driverLocation}
            bikeHeading={tracking.driverLocation?.heading}
            followBikeLocation
          />
        )}
      </div>

      <header className="absolute left-4 right-4 top-4 z-10 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunset/10 text-sunset">
            {tracking?.type === 'parcel' ? (
              <Package aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Bike aria-hidden="true" className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-black">
              {tracking?.type === 'parcel' ? 'Delivery tracking' : 'Ride tracking'}
            </h1>
            <p className="text-sm font-medium text-gray-600">
              {isComplete
                ? 'Journey complete'
                : isMoving
                  ? 'Driver is on the way'
                  : 'Waiting for the driver to start'}
            </p>
          </div>
          {isMoving && <span className="h-2.5 w-2.5 rounded-full bg-sunset animate-pulse" />}
        </div>
      </header>

      <section className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl bg-white p-4 shadow-lg">
        {tracking ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm font-medium text-gray-700">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span className="min-w-0">
                <span className="font-bold text-black">Pickup · </span>{tracking.pickup.address}
              </span>
            </p>
            <p className="flex items-start gap-2 text-sm font-medium text-gray-700">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sunset" />
              <span className="min-w-0">
                <span className="font-bold text-black">Drop-off · </span>{tracking.destination.address}
              </span>
            </p>
            {tracking.updatedAt && (
              <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">
                Location updated {new Date(tracking.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        ) : loading && token ? (
          <p className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-sunset" />
            Loading trip…
          </p>
        ) : (
          <p role="alert" className="text-center text-sm font-semibold text-gray-700">
            {!token ? 'This tracking link is not valid.' : error ?? 'Tracking is unavailable.'}
          </p>
        )}
        {error && tracking && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
      </section>
    </main>
  );
}
