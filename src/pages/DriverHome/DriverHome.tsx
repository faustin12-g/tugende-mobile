import { useState, useCallback } from 'react';
import { Bike, Search } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { PageContainer } from '../../components/ui/PageContainer';
import MapView from '../../components/map/MapView';
import MapSettings from '../../components/map/MapSettings';
import { useAuthStore } from '../../store/authStore';

export default function DriverHome() {
  const [isOnline, setIsOnline] = useState(false);
  const { user } = useAuthStore();
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);

  const handleMapReady = useCallback((map: MapboxMap) => {
    setMapInstance(map);
  }, []);

  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    // Visual feedback: change map style when going online
    if (mapInstance) {
      mapInstance.easeTo({
        zoom: newStatus ? 15 : 14,
        duration: 500,
      });
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
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
              isOnline 
                ? 'bg-sunset text-white' 
                : 'bg-white text-gray-500'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
          </button>
          <MapSettings />
        </div>
      </div>

      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <MapView
          showUserLocation
          onMapReady={handleMapReady}
        />
      </div>

      {/* Bottom Section — floats over the map */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-10 z-10">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-4" />

        {isOnline ? (
          <div className="flex flex-col items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sunset animate-pulse" />
              <span className="text-sm font-medium text-gray-600">Looking for ride requests nearby...</span>
            </div>
            
            {/* Empty state */}
            <div className="w-full bg-gray-50 rounded-2xl p-6 flex flex-col items-center gap-3 border border-gray-100">
              <Search aria-hidden="true" className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
              <p className="text-gray-400 font-medium text-sm text-center">
                Ride requests within 2km will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Bike aria-hidden="true" className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
            <p className="text-gray-400 font-medium text-center">
              Go <span className="text-sunset font-bold">online</span> to start receiving ride requests
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
