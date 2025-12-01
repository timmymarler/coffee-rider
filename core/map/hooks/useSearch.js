import {
  extractGooglePhotoUrls,
  mergeCafeAndGoogle,
} from "@core/map/utils/mergePlaceData";
import { useState } from "react";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
export function useSearch({ cafes = [], setSelectedPlace, mapRef }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // ----------------------------
  // AUTOCOMPLETE
  // ----------------------------
  const onChangeSearchText = async (text) => {
    setQuery(text);

    if (!text || text.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!KEY) return;

    try {
      setIsLoadingSuggestions(true);

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        text
      )}&key=${KEY}&types=establishment`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.status === "OK") {
        setSuggestions(json.predictions);
      } else {
        setSuggestions([]);
      }
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // ----------------------------
  // SELECT SUGGESTION
  // ----------------------------
  async function handleSuggestionPress(item) {
    try {
      const placeId = item.place_id;
      if (!placeId) return;

      const detailsResp = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,photos,rating,user_ratings_total,price_level&key=${KEY}`
      );
      const detailsJson = await detailsResp.json();

      const google = detailsJson.result;
      if (!google) return;

      const googlePhotoUrls = extractGooglePhotoUrls(google, KEY);

      // match CR cafe
      const matchedCafe = findMatchingCafeForGoogle(google, cafes);

      // merge in correct call signature
      const merged = mergeCafeAndGoogle(
        matchedCafe,
        google,
        googlePhotoUrls
      );

      // update UI
      setQuery(google.name);
      setSuggestions([]);
      setSelectedPlace(merged);

      if (mapRef?.current && merged?.latitude && merged?.longitude) {
        mapRef.current.animateToRegion(
          {
            latitude: merged.latitude,
            longitude: merged.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          300
        );
      }
    } catch (err) {
      console.log("Suggestion select error:", err);
    }
  }

  return {
    query,
    suggestions,
    isLoadingSuggestions,
    onChangeSearchText,
    handleSuggestionPress,
    clearSuggestions: () => setSuggestions([]),
  };
}
