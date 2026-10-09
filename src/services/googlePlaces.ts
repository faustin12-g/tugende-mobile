import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const apiKey = import.meta.env.VITE_GOOGLE_PLACES_KEY?.trim();
let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null;

export interface PlaceSelection {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
}

export function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (!apiKey) {
    return Promise.reject(
      new Error('Add a Google Maps API key to VITE_GOOGLE_PLACES_KEY and restart the dev server.')
    );
  }

  if (!placesLibraryPromise) {
    setOptions({ key: apiKey, v: 'weekly' });
    placesLibraryPromise = importLibrary('places') as Promise<google.maps.PlacesLibrary>;
  }

  return placesLibraryPromise;
}

export async function fetchPlaceDetails(
  prediction: google.maps.places.PlacePrediction
): Promise<PlaceSelection> {
  const place = prediction.toPlace();
  await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

  if (!place.id || !place.location) {
    throw new Error('Google Places did not return a location for this result.');
  }

  return {
    id: place.id,
    name: place.displayName ?? prediction.text.toString(),
    address: place.formattedAddress ?? prediction.text.toString(),
    location: {
      lat: place.location.lat(),
      lng: place.location.lng(),
    },
  };
}
