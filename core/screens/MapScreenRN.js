import { getTheme } from "@themes";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

// Hooks
import { useMapData } from "@core/map/hooks/useMapData";
import { useSearch } from "@core/map/hooks/useSearch";

// Components
import { CafeMarker } from "@core/map/components/CafeMarker";
import PlaceCard from "@core/map/components/PlaceCard";

import { RecenterButton } from "@core/map/components/RecenterButton";
import { SearchBar } from "@core/map/components/SearchBar";

export default function MapScreenRN() {
  const theme = getTheme();
  const styles = createStyles(theme);

  // ----------------------------
  // 1. MAP + CAFE STATE
  // ----------------------------
  const {
    region,
    mapRef,
    cafes,
    selectedPlace,
    setSelectedPlace,
    handleCafePress,
    handleMapPress,
    handlePoiPress,
    recenter,
  } = useMapData();

  // ----------------------------
  // 2. SEARCH STATE
  // ----------------------------
  const {
    query,
    suggestions,
    isLoadingSuggestions,
    onChangeSearchText,
    handleSuggestionPress,
    clearSuggestions,
  } = useSearch({ cafes, setSelectedPlace, mapRef });

  // ----------------------------
  // 3. RENDER UI
  // ----------------------------
  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onPress={handleMapPress}
        onPoiClick={handlePoiPress}
      >
        {cafes.map((cafe) => (
          <CafeMarker
            key={cafe.id}
            cafe={cafe}
            onPress={() => handleCafePress(cafe)}
          />
        ))}

        {selectedPlace && (
          <CafeMarker
            cafe={{
              id: "selected",
              coords: {
                latitude: selectedPlace.latitude,
                longitude: selectedPlace.longitude,
              },
              sponsor: false,
            }}
          />
        )}
      </MapView>

      {/* SEARCH BAR */}
      <SearchBar
        query={query}
        onChangeText={onChangeSearchText}
        isLoading={isLoadingSuggestions}
        suggestions={suggestions}
        onSuggestionPress={handleSuggestionPress}
        onClear={clearSuggestions}
        theme={theme}
      />

      {/* RECENTER BUTTON */}
      <RecenterButton onPress={recenter} theme={theme} />

      {/* PLACE CARD */}


{selectedPlace && (
  <PlaceCard
    place={selectedPlace}
    onClose={() => setSelectedPlace(null)}
  />
)}

    </View>
  );
}

// ---------------------------------------
// STYLES
// ---------------------------------------
function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
}
