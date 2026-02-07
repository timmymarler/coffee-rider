import { AuthContext } from "@context/AuthContext";
import { TabBarContext } from "@context/TabBarContext";
import { useLocalSearchParams } from "expo-router";
import { useContext, useEffect, useState } from "react";
import MapScreenRN from "../core/screens/MapScreenRN-TomTom";

export default function Map() {
  const { user } = useContext(AuthContext);
  const { mapReloadKey } = useContext(TabBarContext);
  const [mapKey, setMapKey] = useState(0);
  const params = useLocalSearchParams();

  useEffect(() => {
    setMapKey((k) => k + 1);
  }, [user?.uid, mapReloadKey]);

  // Pass placeId and openPlaceCard as props
  return (
    <MapScreenRN key={mapKey} placeId={params.placeId} openPlaceCard={params.openPlaceCard} />
  );
}
