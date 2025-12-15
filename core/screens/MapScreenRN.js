import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { db } from "@config/firebase";
import { collection, onSnapshot } from "firebase/firestore";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import { FilterBar } from "../map/components/FilterBar";
import { RIDER_FILTER_GROUPS } from "../map/config/riderFilterGroups";

import { applyFilters } from "../map/filters/applyFilters";

import { classifyPoi } from "../map/classify/classifyPois";

//import { applyFilters } from "../map/filters/applyFilters";

/* ------------------------------------------------------------------ */
/* FILTER STATE                                                        */
/* ------------------------------------------------------------------ */

const CATEGORY_ICON_MAP = {
  cafe: "coffee",
  food: "food-fork-drink",
  pub: "beer",
  fuel: "gas-station",
  parking: "parking",
  motorcycle: "motorbike",
  scenic: "forest",
};

const EMPTY_FILTERS = {
  categories: new Set(),
  amenities: new Set(),
};

/* ------------------------------------------------------------------ */
/* SAFE FILTERING                                                      */
/* ------------------------------------------------------------------ */

  // ------------------------------------------------
  // GOOGLE POI SEARCH (TEXT SEARCH) – STABLE VERSION
  // ------------------------------------------------
  const fetchGooglePois = async (
    latitude,
    longitude,
    radius,
    maxResults,
    /* typesList (currently unused) */
  ) => {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key":
              process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": [
              "places.id",
              "places.displayName",
              "places.formattedAddress",
              "places.location",
              "places.types",
              "places.photos",
              "places.rating",
              "places.userRatingCount",
            ].join(","),
          },
          body: JSON.stringify({
            textQuery:
              "cafe OR coffee OR tea OR sandwich OR biker OR motorcycle OR motorbike OR petrol OR gas OR pub OR scenic",
            languageCode: "en",
            locationBias: {
              circle: {
                center: { latitude, longitude },
                radius: radius || 1000,
              },
            },
            maxResultCount: maxResults || 20,
          }),
        }
      );

      const json = await res.json();
      //console.log("TEXT SEARCH JSON:", JSON.stringify(json));

      if (!json.places) {
        return [];
      }

  return json.places.map((place) => {
    const types = Array.isArray(place.types) ? place.types : [];

    // 1️⃣ classify from raw Google data
    const rawCategory = classifyPoi({ types });

    // TEMP, LOCAL normalisation (uses your agreed categories)
    let category = rawCategory;

    if (rawCategory === "coffee_shop") category = "cafe";
    if (rawCategory === "bar") category = "pub";
    if (rawCategory === "restaurant") category = "food";
    if (rawCategory === "auto_parts_store") category = "bikes";
    if (rawCategory === "motorcycle_shop") category = "bikes";
    if (rawCategory === "motorcycle_repair") category = "bikes";

    return {
      id: place.id,
      title: place.displayName?.text || "",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,

      // keep raw types for debugging / future use
      types,
      googleTypes: types,

      // ✅ authoritative app category
      category,

      rating: place.rating,
      userRatingsTotal: place.userRatingCount,

      googlePhotos: place.photos?.map((p) => p.name) || [],
      googlePhotoUrls:
        place.photos?.map(
          (p) =>
            `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
        ) || [],

      source: "google",
    };
  });
    } catch (err) {
      console.log("TEXT SEARCH ERROR:", err);
      return [];
    }
  };


/* ------------------------------------------------------------------ */
/* MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

export default function MapScreenRN() {
  const [crPlaces, setCrPlaces] = useState([]);
  const [googlePois, setGooglePois] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  /* ------------------------------------------------------------ */
  /* LOAD CR PLACES                                               */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "places"), (snapshot) => {
      const places = snapshot.docs.map((doc) => {
        const data = doc.data();
        let category = data.category ?? data.type ?? "other";

        // normalise legacy / google-ish CR values
        if (category === "auto_parts_store") category = "bikes";
        if (category === "motorcycle_shop") category = "bikes";
        if (category === "motorcycle_repair") category = "bikes";

        return {
          id: doc.id,
          source: "cr",
          title: data.name,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          suitability: data.suitability || {},
          amenities: data.amenities || {},
          category,
          ...data,
        };
      });

      setCrPlaces(places);
    });

    return unsub;
  }, []);

  /* ------------------------------------------------------------ */
  /* MAP TAP → GOOGLE POIS                                        */
  /* ------------------------------------------------------------ */

  const handleMapPress = async (e) => {
    try {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const places = await fetchGooglePois(latitude, longitude, 1200, 20);
      const normalised = places.map((p) => {
        const googleTypes = Array.isArray(p.googleTypes)
          ? p.googleTypes
          : Array.isArray(p.types)
          ? p.types
          : [];

        return {
          ...p,
          source: "google",
          googleTypes,
          category: p.category  // Ensure the category is set for Google POIs
        };
      });

      setGooglePois(normalised);
      setSelectedPlace(null);

    } catch (err) {
      console.log("MAP TAP ERROR:", err);
    }
  
  };

  /* ------------------------------------------------------------ */
  /* MERGE + FILTER MARKERS                                       */
  /* ------------------------------------------------------------ */

  const allMarkers = useMemo(
    () => [...crPlaces, ...googlePois],
    [crPlaces, googlePois]
  );

  const filteredMarkers = useMemo(() => {
    if (
      filters.categories.size === 0 &&
      filters.amenities.size === 0
    ) {
      return allMarkers;
    }

    return allMarkers.filter((poi) => applyFilters(poi, filters));
  }, [allMarkers, filters]);


  /* ------------------------------------------------------------ */
  /* RENDER                                                       */
  /* ------------------------------------------------------------ */
  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        onPress={handleMapPress}
        initialRegion={{
          latitude: 52.136,
          longitude: -0.467,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        {filteredMarkers.map((poi) => {

//console.log("📍 MARKER DEBUG", {
//  title: poi.title,
//  category: poi.category,
//  source: poi.source,
//});
          
          if (!poi.latitude || !poi.longitude) return null;

          const isSelected = selectedPlace?.id === poi.id;
          const iconName = CATEGORY_ICON_MAP[poi.category] || "map-marker";

          return (
            <Marker
              key={poi.id}
              coordinate={{
                latitude: poi.latitude,
                longitude: poi.longitude,
              }}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPlace(poi);
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <SvgPin icon={iconName} />
            </Marker>
          );
        })}
      </MapView>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        filterConfig={RIDER_FILTER_GROUPS}
      />

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
