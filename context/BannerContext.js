// context/BannerContext.js
import { createContext, useContext, useRef, useState } from "react";
import { Animated } from "react-native";

const BannerContext = createContext();

export const BannerProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("#333");
  const slideAnim = useRef(new Animated.Value(0)).current;

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setMessage("");
    });
  };

  const showBanner = (msg, type = "info") => {
    setMessage(msg);

    if (type === "success") setColor("#34C759");      // green
    else if (type === "warning") setColor("#FF9500"); // orange
    else if (type === "error") setColor("#FF3B30");   // red
    else setColor("#333");                            // default

    setVisible(true);

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setMessage("");
    });
  };

  return (
    <BannerContext.Provider
      value={{
        visible,
        message,
        color,
        slideAnim,
        showBanner,
      }}
    >
      {children}
    </BannerContext.Provider>
  );
};

export const useBanner = () => useContext(BannerContext);
