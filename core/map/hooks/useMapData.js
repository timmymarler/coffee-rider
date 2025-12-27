import { db } from "@config/firebase";
import * as Location from "expo-location";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import { getGoogleDetails } from "@core/map/utils/getGoogleDetails";
import { mergeCafeAndGoogle } from "@core/map/utils/mergePlaceData";

export function useMapData() {
  // ----------------------------------------
  // REGION + MAP REF
  // ----------------------------------------
  const [region] = useState({
    latitude: 52.2,
    longitude: -0.5,
    latitudeDelta: 0.4,
    longitudeDelta: 0.4,
  });

  const mapRef = useRef(null);


  // ----------------------------------------
  // CAFÉ + GOOGLE STATE
  // ----------------------------------------
  const [cafes, setCafes] = useState([]);
  const [googlePlaces, setGooglePlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // ----------------------------------------
  // LOAD CR CAFÉS
  // ----------------------------------------
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "cafes"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        latitude: d.data().coords?.latitude ?? d.data().latitude,
        longitude: d.data().coords?.longitude ?? d.data().longitude,
      }));
      setCafes(list);
    });

    return unsub;
  }, []);

  // ----------------------------------------
  // RESULT MARKERS
  // ----------------------------------------
  const mergedMarkers = [...cafes, ...googlePlaces];

  // ----------------------------------------
  // TAPPING A CR MARKER (MERGE WITH GOOGLE)
  // ----------------------------------------
  async function handleCafePress(cafe) {
    try {
      const google = await getGoogleDetails({
        placeId: cafe.placeId,
        name: cafe.name || cafe.title,
        latitude: cafe.coords?.latitude ?? cafe.latitude,
        longitude: cafe.coords?.longitude ?? cafe.longitude,
      });

      const googlePhotoUrls =
        google?.photos?.map(
          (p) =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
        ) ?? [];

      const merged = mergeCafeAndGoogle(cafe, google, googlePhotoUrls);

      setSelectedPlace(merged);
    } catch (err) {
      console.log("Marker merge error:", err);
      setSelectedPlace(cafe);
    }
  }

  // ----------------------------------------
  // TAPPING MAP CLEARS SELECTION
  // ----------------------------------------
  function handleMapPress() {
    setSelectedPlace(null);
  }

  // ----------------------------------------
  // TAPPING A GOOGLE POI ON THE MAP
  // ----------------------------------------
  function handlePoiPress(e) {
    const { coordinate, name, placeId } = e.nativeEvent;

    setGooglePlaces([
      {
        id: placeId || "poi",
        title: name,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        source: "google",
      },
    ]);

    setSelectedPlace(null);
  }

  // ----------------------------------------
  // RECENTER TO USER LOCATION
  // ----------------------------------------
  async function recenter() {
    if (!mapRef.current) return;

    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      350
    );
  }

  // ----------------------------------------
  // RETURN API FOR MAPSCREENRN
  // ----------------------------------------
  return {
    region,
    mapRef,
    cafes,
    mergedMarkers,
    selectedPlace,
    setSelectedPlace,
    handleCafePress,
    handleMapPress,
    handlePoiPress,
    recenter,
  };
}
