export default {
  colors: {
    background: "#000",
    primary: "#1e90ff",
    accent: "#ffc107",
    cardBackground: "#111",
    border: "#333",
    danger: "#cd3434ff",

    // Core Rider blues (you can tweak exact hexes later)
    primaryDark:  "#0F2A38", // deep blue-teal, strong not muddy
    primaryMid:   "#163B4F", // saturated slate-blue
    primaryLight: "#1F566F", // confident blue for borders/highlights
    primaryBackground: "#2a3e48ff",

    // Gold accents – original Coffee Rider feel
    accentDark: "#C5A041",
    accentMid: "#FFD85C",
    accentLight: "#FFF2C7",

    // Use Strider as accents
    secondaryDark: "#2F622D",
    secondaryMid: "#699955",
    secondaryLight: "#A4BF8F",


    // App surfaces
    // You said main screen background should be “the blue”, we’ll use primaryMid here.
    background: "#587587",
    surface: "#1E3B57",

    // Text
    text: "#FFFFFF",
    textMuted: "#D2D9E2",

    // Form inputs
    inputBackground: "#FFFFFF",
    inputBorder: "#8CAAB3",
    inputText: "#1E3B57",

    // Tabs
    tabBarBackground: "#1E3B57",
    tabBarActive: "#FFD85C",
    tabBarInactive: "#8CAAB3",

    // Semantic feedback colours – used by brand themes
    success: "#22c55e",
    error: "#cd3434ff",
    warning: "#FACC15",
  
  },
  // spacing scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  // Border radius scale
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 999,
  },
  // Typography scale
  typography: {
    h1: { fontSize: 22, fontWeight: "700" },
    h2: { fontSize: 18, fontWeight: "600" },
    h3: { fontSize: 16, fontWeight: "600" },
    body: { fontSize: 14, fontWeight: "400" },
    small: { fontSize: 12, fontWeight: "400" },
  },
    pinBase: {
      width: 24,
      height: 24,
      borderRadius: 12,          // ✅ critical
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      shadowColor: "#000",
      shadowOpacity: 0.45,
      shadowRadius: 2,
      elevation: 3,
    },

    pinTail: {
      position: "absolute",
      bottom: -6,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
    },

    pinSelected: {
        transform: [
            { scale: 1.15 },
        ],
    },

}