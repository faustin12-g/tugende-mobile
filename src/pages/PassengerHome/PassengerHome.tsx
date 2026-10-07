import { useCallback, useState } from 'react';
import { Bike, MapPin, Package, Search } from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import MapView from '../../components/map/MapView';
import { useAuthStore } from '../../store/authStore';

export default function PassengerHome() {
  const { user } = useAuthStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const handleLocationFound = useCallback((coords: { lat: number; lng: number }) => {
    setUserLocation(coords);
  }, []);

  return (
    <PageContainer withPadding={false} className="relative h-screen !min-h-0">
      {/* Header — floats over the map */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-center z-10">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
          <h1 className="text-xl font-bold text-black tracking-tight">Tugende</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-white shadow-lg border-2 border-white flex items-center justify-center overflow-hidden">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <MapView
          showUserLocation
          onLocationFound={handleLocationFound}
        />
      </div>

      {/* Bottom Sheet — floats over the map */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 space-y-4 z-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />
        
        {/* Search bar */}
        <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 border border-gray-100">
          <div className="w-3 h-3 rounded-full bg-sunset" />
          <span className="text-gray-400 font-medium flex-1">Where to?</span>
          <Search aria-hidden="true" className="w-5 h-5 text-gray-400" />
        </div>

        {/* Quick actions */}
        <div className="flex gap-3">
          <Button variant="outline" fullWidth className="py-4">
            <Bike aria-hidden="true" className="mr-2 h-5 w-5" /> Book a Ride
          </Button>
          <Button variant="outline" fullWidth className="py-4">
            <Package aria-hidden="true" className="mr-2 h-5 w-5" /> Send Parcel
          </Button>
        </div>

        {/* Current location indicator */}
        {userLocation && (
          <p className="text-xs text-gray-400 text-center">
            <MapPin aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
            Location found • Ready to book
          </p>
        )}
      </div>
    </PageContainer>
  );
}
