// components/Banner.js
import { Ionicons } from "@expo/vector-icons";
import { Animated, Text } from "react-native";
import { useBanner } from "../context/BannerContext";

export default function Banner() {
  const { visible, message, color, slideAnim } = useBanner();

  if (!visible) {
    // Still animate opacity/position, but nothing to show
    // Returning the Animated.View is fine; early return is optional
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 100,
        left: 0,
        right: 0,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
        opacity: slideAnim,
        zIndex: 9999,
        transform: [
          {
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-60, 0],
            }),
          },
        ],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
      }}
    >
      <Ionicons
        name="information-circle"
        size={22}
        color="#fff"
        style={{ marginRight: 8 }}
      />
      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
        {message}
      </Text>
    </Animated.View>
  );
}
