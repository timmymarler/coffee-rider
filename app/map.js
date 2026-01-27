import { AuthContext } from "@context/AuthContext";
import { TabBarContext } from "@context/TabBarContext";
import { useContext, useEffect, useState } from "react";
import MapScreenRN from "../core/screens/MapScreenRN-TomTom";

export default function Map() {
  const { user } = useContext(AuthContext);
  const { mapReloadKey } = useContext(TabBarContext);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    setMapKey((k) => k + 1);
  }, [user?.uid, mapReloadKey]); // 👈 THIS is what was missing

  return (
    <MapScreenRN key={mapKey} /> // 👈 key, not prop
  );
}
