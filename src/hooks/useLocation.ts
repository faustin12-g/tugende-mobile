import { useState, useEffect, useCallback } from 'react';

interface LocationState {
  lat: number;
  lng: number;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

// Kigali fallback coordinates
const KIGALI_FALLBACK = { lat: -1.9403, lng: 29.8739 };

/**
 * Hook to get and track the user's current GPS location.
 * Falls back to Kigali center if geolocation is unavailable.
 */
export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    lat: KIGALI_FALLBACK.lat,
    lng: KIGALI_FALLBACK.lng,
    accuracy: null,
    loading: true,
    error: null,
  });

  const updateLocation = useCallback((position: GeolocationPosition) => {
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      loading: false,
      error: null,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    console.warn('[useLocation] Geolocation error:', error.message);
    setLocation((prev) => ({
      ...prev,
      loading: false,
      error: error.message,
    }));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported',
      }));
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });

    // Watch for position updates
    const watchId = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updateLocation, handleError]);

  return location;
}

