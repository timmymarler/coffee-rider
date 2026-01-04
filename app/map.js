import { AuthContext } from "@context/AuthContext";
import { WaypointsProvider } from "@core/map/waypoints/WaypointsContext";
import { useContext, useEffect, useState } from "react";
import MapScreenRN from "../core/screens/MapScreenRN";

export default function Map() {
  const { user } = useContext(AuthContext);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    // Force MapView remount when auth changes
    setMapKey((k) => k + 1);
  }, [user?.uid]);

  return (
    <WaypointsProvider>
      <MapScreenRN mapKey={mapKey} />
    </WaypointsProvider>
  );
}
