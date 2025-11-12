import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Animated,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const storage = getStorage();

async function uploadPhotoAsync(uri, cafeId) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(storage, `cafes/${cafeId}/${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob);
  return await getDownloadURL(fileRef);
}

export default function AddCafeScreen() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [droppedPin, setDroppedPin] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [serviceRating, setServiceRating] = useState(null);
  const [valueRating, setValueRating] = useState(null);
  const [priceRange, setPriceRange] = useState("£");
  const [bikes, setBikes] = useState(false);
  const [scooters, setScooters] = useState(false);
  const [cyclists, setCyclists] = useState(false);
  const [cars, setCars] = useState(false);
  const [offRoadParking, setOffRoadParking] = useState(false);
  const [pets, setPets] = useState(false);
  const [disability, setDisability] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);
  const mapHeight = useRef(new Animated.Value(450)).current;
  const bannerAnim = useState(new Animated.Value(0))[0];
  const [region, setRegion] = useState(null);
  const [photos, setPhotos] = useState([]);

  const [banner, setBanner] = useState({
    text: "",
    color: "#34C759",
    icon: "checkmark-circle",
  });

  const toggleMap = () => {
    const toValue = mapVisible ? 0 : 450;
    setMapVisible(!mapVisible);
    Animated.timing(mapHeight, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const showBanner = (message, color = "#34C759", icon = "checkmark-circle") => {
    setBanner({ text: message, color, icon });
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(bannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  function computeOverallSeed(service, value) {
    const parts = [service, value].filter((x) => typeof x === "number" && !Number.isNaN(x));
    if (parts.length === 0) return null;
    const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
    return Math.round(avg);
  }

  const facilities = [
    { key: "bikes", icon: "motorbike", state: bikes, setState: setBikes },
    { key: "scooters", icon: "moped", state: scooters, setState: setScooters },
    { key: "cyclists", icon: "bicycle", state: cyclists, setState: setCyclists },
    { key: "cars", icon: "car", state: cars, setState: setCars },
    { key: "offRoadParking", icon: "parking", state: offRoadParking, setState: setOffRoadParking },
    { key: "pets", icon: "dog-side", state: pets, setState: setPets },
    { key: "disability", icon: "wheelchair-accessibility", state: disability, setState: setDisability },
  ];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(coords);
      } catch (error) {
        console.error("Error getting location:", error);
      }
    })();
  }, []);

  const handleMapPress = async (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setDroppedPin({ latitude, longitude });

    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const { name, street, city, region } = results[0];
        const line = name || street || city || region || "Unknown location";
        setLocationText(line);
      } else setLocationText("Unknown location");
    } catch {
      setLocationText("Unknown location");
    }
  };

  const handleAddCafe = async () => {
    if (!user) return showBanner("Sign in to add a café", "#ff3b30", "alert-circle");
    if (!name.trim()) return showBanner("Name is required", "#ff3b30", "alert-circle");
    if (!droppedPin) return showBanner("Tap on the map to drop a pin", "#ff3b30", "alert-circle");

    try {
      setSaving(true);
// Upload selected photos (if any)
let uploadedUrls = [];
if (photos.length > 0) {
  uploadedUrls = await Promise.all(
    photos.map((uri) => uploadPhotoAsync(uri, user.uid))
  );
}

const cafeRef = await addDoc(collection(db, "cafes"), {
  name: name.trim(),
  location: locationText?.trim() || "No description",
  coords: {
    latitude: droppedPin.latitude,
    longitude: droppedPin.longitude,
  },
  offRoadParking,
  bikes,
  scooters,
  cyclists,
  cars,
  pets,
  disability,
  serviceRating: typeof serviceRating === "number" ? serviceRating : null,
  valueRating: typeof valueRating === "number" ? valueRating : null,
  priceRange,
  photos: uploadedUrls,
  photoURL: uploadedUrls[0] || null,
  createdAt: new Date().toISOString(),
  userId: user.uid,
});


      const overallSeed = computeOverallSeed(serviceRating, valueRating);
      await setDoc(
        doc(db, `cafes/${cafeRef.id}/ratings/${user.uid}`),
        {
          userId: user.uid,
          service: serviceRating ?? null,
          value: valueRating ?? null,
          overall: overallSeed,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      showBanner("Café added", "#34C759", "checkmark-circle");
      resetForm();
    } catch (e) {
      console.error("Add Café failed:", e);
      showBanner("Couldn’t add café", "#ff3b30", "alert-circle");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDroppedPin(null);
    setLocationText("");
    setServiceRating(null);
    setValueRating(null);
    setPriceRange("£");
    setBikes(false);
    setScooters(false);
    setCyclists(false);
    setCars(false);
    setOffRoadParking(false);
    setPets(false);
    setDisability(false);
    setPhotos([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
            ],
            backgroundColor: banner.color,
          },
        ]}
      >
        <Ionicons name={banner.icon} size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.bannerText}>{banner.text}</Text>
      </Animated.View>

      <TouchableOpacity onPress={toggleMap} style={styles.mapToggle}>
        <Ionicons
          name={mapVisible ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007aff"
          style={{ marginRight: 4 }}
        />
        <Text style={{ color: "#007aff", fontWeight: "500" }}>
          {mapVisible ? "Hide map" : "Show map"}
        </Text>
      </TouchableOpacity>

      <Animated.View style={{ height: mapHeight, overflow: "hidden", marginBottom: 12 }}>
        <MapView
          style={{ flex: 1 }}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {droppedPin && (
            <Marker coordinate={droppedPin} pinColor="red" title="New Café Location" />
          )}
        </MapView>
      </Animated.View>

      <InputRow icon="cafe-outline" placeholder="Café name" value={name} onChange={setName} />
      <InputRow icon="location-outline" placeholder="Location" value={locationText} onChange={setLocationText} />

      <TouchableOpacity onPress={pickPhoto} style={styles.addPhotoButton}>
        <Ionicons name="camera" size={18} color="#007aff" />
        <Text style={{ color: "#007aff", marginLeft: 6 }}>Add Photo</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
        {photos.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: 80, height: 80, borderRadius: 6, marginRight: 8, marginBottom: 8 }}
          />
        ))}
      </View>

      <Text style={{ fontWeight: "600", marginBottom: 4 }}>Service Rating</Text>
      <StarRating value={serviceRating || 0} onChange={setServiceRating} />
      <Text style={{ fontWeight: "600", marginBottom: 4 }}>Value Rating</Text>
      <StarRating value={valueRating || 0} onChange={setValueRating} />

      <View style={styles.flags}>
        {["£", "££", "£££", "££££"].map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPriceRange(p)}
            style={[styles.toggle, priceRange === p && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, priceRange === p && { color: "#fff" }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontWeight: "600", marginBottom: 6 }}>Facilities</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
        {facilities.map(({ key, icon, state, setState }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setState(!state)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 1,
              margin: 1,
              backgroundColor: state ? "#007aff" : "#eee",
              borderRadius: 6,
            }}
          >
            <MaterialCommunityIcons
              name={icon}
              size={25}
              color={state ? "#fff" : "#333"}
              style={{ marginRight: 6 }}
            />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleAddCafe}
        disabled={saving}
        style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Add Café</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function InputRow({ icon, placeholder, value, onChange }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color="#007aff" style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

function StarRating({ value, onChange }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={{ flexDirection: "row", marginBottom: 12 }}>
      {stars.map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} style={{ marginRight: 6 }}>
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={28}
            color={star <= value ? "#007aff" : "#8fb8ff"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10, paddingHorizontal: 20, backgroundColor: "#fff" },
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 10,
  },
  bannerText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  mapToggle: { flexDirection: "row", alignItems: "center", marginBottom: 8, padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#333", fontWeight: "500" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 10 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  toggleOn: { backgroundColor: "#007aff", borderColor: "#007aff" },
  toggleText: { color: "#333", fontWeight: "600" },
  saveButton: {
    backgroundColor: "#007aff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
