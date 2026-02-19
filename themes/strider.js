export default {
  brandName: {
    name: "Strider",
  },

  colors: {
    // Greens for independent strikers (self-reliant, active)
    primaryDark: "#0F2A38",
    primaryMid: "#2A5A2A",
    primaryLight: "#4A8A3A",
    primaryBackground: "#2a3e48",

    // Use Rider gold accents
    accentDark: "#C5A041",
    accentMid: "#FFD85C",
    accentLight: "#FFF2C7",

    // Use Rider blues as secondary
    secondaryDark: "#0F2A38",
    secondaryMid: "#163B4F",
    secondaryLight: "#1F566F",

    // App surfaces
    background: "#2D4A2A",
    surface: "#1F3A1A",

    // Text
    text: "#FFFFFF",
    textMuted: "#D7E5CF",

    // Form inputs
    inputBackground: "#FFFFFF",
    inputBorder: "#A4BF8F",
    inputText: "#21461F",

    // Tabs
    tabBarBackground: "#2F622D",
    tabBarActive: "#9A714F",
    tabBarInactive: "#A4BF8F",

    // Semantic feedback
    success: "#22c55e",
    error: "#DC2626",
    warning: "#FACC15",
    danger: "#DC2626",
  },

  // POI marker colors
  poi: {
    cafe: "#8B4513",
    restaurant: "#D4641D",
    pub: "#8B0000",
    bikes: "#DC143C",
    fuel: "#006994",
    parking: "#556B2F",
    scenic: "#228B22",
    camping: "#228B22",
    accommodation: "#663399",
    unknown: "#696969",
  },

  // Spacing scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
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

  // Pin styles for markers
  pinBase: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    transform: [{ scale: 1.15 }],
  },
};

