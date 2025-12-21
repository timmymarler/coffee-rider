import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { db } from "@config/firebase";
import { collection, onSnapshot } from "firebase/firestore";

import PlaceCard from "../map/components/PlaceCard";
import SvgPin from "../map/components/SvgPin";

import * as Location from "expo-location";
import { classifyPoi } from "../map/classify/classifyPois";
import { FilterBar } from "../map/components/FilterBar";
import { RIDER_FILTER_GROUPS } from "../map/config/riderFilterGroups";
import { applyFilters } from "../map/filters/applyFilters";

/* ------------------------------------------------------------------ */
/* CATEGORY → ICON MAP (authoritative)                                 */
/* ------------------------------------------------------------------ */
const CATEGORY_ICON_MAP = {
  cafe: "coffee",
  restaurant: "silverware-fork-knife",
  pub: "beer",
  fuel: "gas-station",
  parking: "parking",
  scenic: "forest",
  bikes: "motorbike",
  scooters: "moped",
};

const GOOGLE_CATEGORY_QUERIES = {
  cafe: [
      "cafe",
      "coffee",
      "coffee shop",
      "brasserie",
  ].join(" OR "),
  
  restaurant: [
      "restaurant",
      "food",
  ].join(" OR "), 
  
  pub: "pub OR bar",
  
  parking: "parking",
  
  scenic: "viewpoint OR scenic OR landmark OR park",
  
  fuel: [
    "petrol station",
    "gas station",
    "service station",
    "fuel station"
  ].join(" OR "),
  
  bikes: [
    "motorcycle",
    "motorbike",
    "motorcycle repair",
    "motorcycle dealer",
    "motorbike garage",
    "motorcycle service",
    "motorcycle tyres",
    "superbike",
  ].join(" OR "),
  
  scooters: [
    "scooter",
    "scooters",
    "scooter repair",
    "scooter dealer",
    "scooter garage",
    "scooter service",
    "scooter tyres"
  ].join(" OR "),
};


/* ------------------------------------------------------------------ */
/* FILTER STATE                                                        */
/* ------------------------------------------------------------------ */

const EMPTY_FILTERS = {
  categories: new Set(),
  amenities: new Set(),
};

/* ------------------------------------------------------------------ */
/* GOOGLE POI SEARCH                                                   */
/* ------------------------------------------------------------------ */
function dedupeById(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.source}-${it.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

const fetchGooglePois = async (
  latitude,
  longitude,
  radius,
  maxResults,
  textQuery,
  intentCategory,
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
            "places.regularOpeningHours",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery,
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
    if (!json.places) return [];

    return json.places.map((place) => {
      const types = Array.isArray(place.types) ? place.types : [];
      const category = intentCategory ?? classifyPoi({ types });
      const renderIcon =
        intentCategory === "bikes" || intentCategory === "scooters"
          ? intentCategory
          : category;

      return {
        id: place.id,
        title: place.displayName?.text || "",
        address: place.formattedAddress || "",
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        googleTypes: types,
        category,
        renderIcon,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        regularOpeningHours: place.regularOpeningHours,
        googlePhotoUrls:
          place.photos?.map(
            (p) =>
              `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
          ) || [],
        source: "google",
        amenities: [],
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
  const [userLocation, setUserLocation] = useState(null);
  const isTwoWheelsMode =
    filters.categories.has("bikes") &&
    filters.categories.has("scooters");

  const mapRef = useRef(null);
  const markerPressRef = useRef(false);

  /* ------------------------------------------------------------ */
  /* LOAD CR PLACES                                               */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "places"), (snapshot) => {
      const places = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          source: "cr",
          title: data.name,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          category: data.category || "unknown",
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          suitability: data.suitability || {},
          ...data,
        };
      });

      setCrPlaces(places);
      
    });

    return unsub;
  }, []);

  const crByGoogleId = useMemo(() => {
    const m = new Map();
    for (const p of crPlaces || []) {
      if (p.googlePlaceId) m.set(p.googlePlaceId, p);
    }
    return m;
  }, [crPlaces]);

  const annotateGooglePois = (pois) => {
    return (pois || []).map((poi) => {
      const crMatch = poi?.id ? crByGoogleId.get(poi.id) : null;

      if (crMatch) {
        return {
          ...poi,
          source: "google",       // exists in CR already
          crId: crMatch.id,       // optional: useful for “open CR place”
        };
      }

      return {
        ...poi,
        source: "google-new",    // not yet in CR
      };
    });
  };
  
  /* ------------------------------------------------------------ */
  /* USER LOCATION                                                */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
    })();
  }, []);

  /* ------------------------------------------------------------ */
  /* MAP TAP → GOOGLE POIS                                        */
  /* ------------------------------------------------------------ */

  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const isTwoWheelsMode =
      filters.categories.has("bikes") &&
      filters.categories.has("scooters");

    // Combined Bikes + Scooters: do TWO searches so each result gets a real category
    if (isTwoWheelsMode) {
      const [bikePois, scooterPois] = await Promise.all([
        fetchGooglePois(
          latitude,
          longitude,
          1200,
          20,
          GOOGLE_CATEGORY_QUERIES.bikes,
          "bikes"
        ),
        fetchGooglePois(
          latitude,
          longitude,
          1200,
          20,
          GOOGLE_CATEGORY_QUERIES.scooters,
          "scooters"
        ),
      ]);

      setGooglePois(annotateGooglePois(dedupeById([...bikePois, ...scooterPois])));
      setSelectedPlace(null);
      return;
    }


    // Normal path (0 or 1 category or other mixes)
    const query = buildGoogleQuery(filters);
    const intentCategory = getIntentCategory(filters);

    const pois = await fetchGooglePois(
      latitude,
      longitude,
      1200,
      20,
      query,
      intentCategory
    );

    setGooglePois(annotateGooglePois(pois));
    setSelectedPlace(null);
  };


    // Scroll map to show POIs
    const handleRegionChangeComplete = async (region) => {
      // Ignore tiny movements if you want (optional optimisation)
      if (!region) return;

      const { latitude, longitude, latitudeDelta } = region;

      // Decide zoom level from delta
      const zoomLevel =
        latitudeDelta < 0.03 ? "close" :
        latitudeDelta < 0.08 ? "medium" :
        "far";

      // Call existing fetch logic
      await fetchPoisForRegion(latitude, longitude, zoomLevel);
    };  

    // As it says, fetch POIs based on the current region
    const fetchPoisForRegion = async (latitude, longitude, zoomLevel) => {
      const radius =
        zoomLevel === "close" ? 600 :
        zoomLevel === "medium" ? 1200 :
        2500;

      const limit =
        zoomLevel === "close" ? 40 :
        zoomLevel === "medium" ? 25 :
        12;

      const query = buildGoogleQuery(filters);
      const intentCategory = getIntentCategory(filters);

      const pois = await fetchGooglePois(
        latitude,
        longitude,
        radius,
        limit,
        query,
        intentCategory
      );

      setGooglePois(pois);
    };

  /* ------------------------------------------------------------ */
  /* MERGE + FILTER                                               */
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


  function buildGoogleQuery(filters) {
    // Default: rider-relevant, ambient places only
    if (!filters.categories || filters.categories.size === 0) {
      return [
        GOOGLE_CATEGORY_QUERIES.cafe,
        GOOGLE_CATEGORY_QUERIES.pub,
        GOOGLE_CATEGORY_QUERIES.scenic,
        GOOGLE_CATEGORY_QUERIES.fuel,
        GOOGLE_CATEGORY_QUERIES.parking,
        //GOOGLE_CATEGORY_QUERIES.bikes,
        //GOOGLE_CATEGORY_QUERIES.scooters,
      ].join(" OR ");
    }

    // Explicit filters: user knows what they want
    return Array.from(filters.categories)
      .map((cat) => GOOGLE_CATEGORY_QUERIES[cat])
      .filter(Boolean)
      .join(" OR ");
  }

  // Needed to match Bikes / Scooters as no valuable Google Types are available
  function getIntentCategory(filters) {
    if (!filters.categories || filters.categories.size !== 1) {
      return null;
    }
    return Array.from(filters.categories)[0];
  }

  /* ------------------------------------------------------------ */
  /* RENDER                                                       */
  /* ------------------------------------------------------------ */

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={() => setSelectedPlace(null)}
        initialRegion={{
          latitude: 52.136,
          longitude: -0.467,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
{filteredMarkers.map((poi) => {
  if (!poi.latitude || !poi.longitude) return null;

  const iconName =
    poi.renderIcon === "bikes" || poi.renderIcon === "scooters"
      ? "racing-helmet"
      : CATEGORY_ICON_MAP[poi.category] || "map-marker";

  const isSelected = String(selectedPlace?.id) === String(poi.id);
  const isCr = poi.source === "cr";

  // 0 = google, 1 = cr, 2 = selected
  const tier = isSelected ? 2 : isCr ? 1 : 0;

  // SCALE (this is the important part)
  const scale = tier === 2 ? 1.35 : tier === 1 ? 1.18 : 1.0;

  // COLOUR (only works if SvgPin supports it)
  const color =
    tier === 2
      ? "#FFF2C7"   // selected
      : tier === 1
      ?  "#FFD85C"   // CR
      : "#C5A041"; // google

  // Force remount when tier changes (kills ghost markers)
  const markerKey = `${poi.id}-${tier}`;

  return (
    <Marker
      key={markerKey}
      coordinate={{
        latitude: poi.latitude,
        longitude: poi.longitude,
      }}
      onPress={(e) => {
        e.stopPropagation();
        markerPressRef.current = true;
        setSelectedPlace(poi);
      }}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={tier === 2 ? 1000 : tier === 1 ? 50 : 1}
      tracksViewChanges={true}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        <SvgPin
          icon={iconName}
          size={28}     // KEEP CONSTANT
          fill={color} // may or may not apply depending on SvgPin
          circle={color}
        />
      </View>
    </Marker>
  );
})}
      </MapView>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        filterConfig={RIDER_FILTER_GROUPS}
      />

      <TouchableOpacity
        onPress={() => {
          if (!userLocation) return;
          mapRef.current?.animateToRegion(
            {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            300
          );
        }}
        style={styles.recenterButton}
      >
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={22}
          color="#C5A041"
        />
      </TouchableOpacity>

      {selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          userLocation={userLocation}
          onClose={() => setSelectedPlace(null)}
          onNavigate={() => ""}
          onRoute={() => ""}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 95,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
});
