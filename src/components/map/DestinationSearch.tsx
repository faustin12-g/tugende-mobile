import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { fetchPlaceDetails, loadPlacesLibrary, type PlaceSelection } from '../../services/googlePlaces';

const KIGALI_CENTER = { lat: -1.9403, lng: 29.8739 };

interface DestinationSearchProps {
  userLocation: { lat: number; lng: number } | null;
  selectedPlace: PlaceSelection | null;
  onSelect: (place: PlaceSelection | null) => void;
}

export default function DestinationSearch({
  userLocation,
  selectedPlace,
  onSelect,
}: DestinationSearchProps) {
  const [input, setInput] = useState(selectedPlace?.address ?? '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (input.trim().length < 2 || selectedPlace) return;

    const currentRequestId = ++requestId.current;

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const places = await loadPlacesLibrary();
        const token = sessionToken.current ?? new places.AutocompleteSessionToken();
        sessionToken.current = token;
        const { suggestions: results } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: input.trim(),
          includedRegionCodes: ['rw'],
          language: 'en',
          locationBias: {
            center: userLocation ?? KIGALI_CENTER,
            radius: 30_000,
          },
          region: 'rw',
          sessionToken: token,
        });

        if (currentRequestId === requestId.current) {
          setSuggestions(results.filter((result) => result.placePrediction));
        }
      } catch (searchError) {
        if (currentRequestId === requestId.current) {
          setError(searchError instanceof Error ? searchError.message : 'Could not search places.');
          setSuggestions([]);
        }
      } finally {
        if (currentRequestId === requestId.current) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      requestId.current += 1;
    };
  }, [input, selectedPlace, userLocation]);

  const handleSelect = async (prediction: google.maps.places.PlacePrediction) => {
    requestId.current += 1;
    setSuggestions([]);
    setLoading(false);
    setSelecting(true);
    setError(null);
    try {
      const place = await fetchPlaceDetails(prediction);
      sessionToken.current = null;
      setInput(place.address);
      setSuggestions([]);
      onSelect(place);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Could not load this place.');
    } finally {
      setSelecting(false);
    }
  };

  const handleInputChange = (value: string) => {
    requestId.current += 1;
    if (selectedPlace) onSelect(null);
    setSuggestions([]);
    setLoading(false);
    setError(null);
    setInput(value);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <span className="h-3 w-3 shrink-0 rounded-full bg-sunset" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-label="Where to?"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls="destination-suggestions"
          autoComplete="off"
          placeholder="Where to?"
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-medium text-gray-800 outline-none placeholder:text-gray-400"
        />
        {loading || selecting ? (
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <Search aria-hidden="true" className="h-5 w-5 text-gray-400" />
        )}
      </label>

      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          <ul
            id="destination-suggestions"
            role="listbox"
            aria-label="Place suggestions"
            className="max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion) => {
              const prediction = suggestion.placePrediction;
              if (!prediction) return null;
              return (
                <li key={prediction.placeId} role="option" aria-selected="false">
                  <button
                    type="button"
                    disabled={selecting}
                    onClick={() => void handleSelect(prediction)}
                    className="flex w-full items-start gap-3 border-b border-gray-100 p-4 text-left last:border-b-0 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-800">
                        {prediction.mainText?.text ?? prediction.text.toString()}
                      </span>
                      {prediction.secondaryText && (
                        <span className="mt-0.5 block truncate text-xs text-gray-500">
                          {prediction.secondaryText.text}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end border-t border-gray-100 px-3 py-2">
            <img
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
              alt="Powered by Google"
              width="120"
              height="14"
            />
          </div>
        </div>
      )}

      {loading && input.trim().length >= 2 && suggestions.length === 0 && (
        <p className="mt-2 text-center text-xs text-gray-500" role="status">Searching places…</p>
      )}
      {!loading && !error && input.trim().length >= 2 && !selectedPlace && suggestions.length === 0 && (
        <p className="mt-2 text-center text-xs text-gray-500" role="status">No places found. Try another search.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
