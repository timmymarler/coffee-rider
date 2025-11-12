// context/BannerContext.js
import { createContext, useContext, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

const BannerContext = createContext();

export const BannerProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("#007AFF"); // iOS blue
  const slideAnim = useState(new Animated.Value(-120))[0];

  const showBanner = (msg, type = "info") => {
    console.log("showBanner called:", { message, type });

    setMessage(msg);
    // Set banner colour
    if (type === "success") setColor("#37ac10ff");
    else if (type === "error") setColor("#FF3B30");
    else setColor("#333");

    setVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(hideBanner, 2500);
    });
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };


  return (
    <BannerContext.Provider value={{ showBanner, hideBanner }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.banner,
            {
              backgroundColor: color,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.text}>{message || "Coffee Rider"}</Text>
        </Animated.View>
      )}
    </BannerContext.Provider>
  );
};

export const useBanner = () => useContext(BannerContext);

const styles = StyleSheet.create({
banner: {
  position: "absolute",
  top: 100,
  left: 0,
  right: 0,
  paddingVertical: 16,
  alignItems: "center",
  zIndex: 99999,
  elevation: 20,
  backgroundColor: "red", // just for visibility
},

  text: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
});
