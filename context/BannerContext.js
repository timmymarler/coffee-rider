import { Ionicons } from "@expo/vector-icons";
import { createContext, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const BannerContext = createContext();

export function BannerProvider({ children }) {
  const [banner, setBanner] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const showBanner = (message, color = "#007AFF", icon = "information-circle") => {
    setBanner({ message, color, icon });
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setBanner(null));
  };

  return (
    <BannerContext.Provider value={{ showBanner }}>
      {children}
      {banner && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.banner, { backgroundColor: banner.color, opacity }]}>
            <Ionicons name={banner.icon} size={20} color="white" style={styles.icon} />
            <Text style={styles.text}>{banner.message}</Text>
          </Animated.View>
        </View>
      )}
    </BannerContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    zIndex: 9999,
  },
  text: { color: "white", fontSize: 16 },
  icon: { marginRight: 8 },
});

export function useBanner() {
  return useContext(BannerContext);
}
