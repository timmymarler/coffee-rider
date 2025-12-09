export default {
  colors: {
    background: "#000",
    text: "#fff",
    primary: "#1e90ff",
    accent: "#ffc107",
    cardBackground: "#111",
    border: "#333",

    // Greens
    primaryDark: "#2F622D",
    primaryMid: "#699955",
    primaryLight: "#A4BF8F",
    primaryBackground: "#FBFBFA",

    // Use Driver browns as accents
    accentDark: "#6A4326",
    accentMid: "#9A714F",
    accentLight: "#CEA57D",

    background: "#699955",
    surface: "#2F622D",

    text: "#FFFFFF",
    textMuted: "#D7E5CF",

    inputBackground: "#FFFFFF",
    inputBorder: "#A4BF8F",
    inputText: "#21461F",

    tabBarBackground: "#2F622D",
    tabBarActive: "#9A714F",
    tabBarInactive: "#A4BF8F",

    // Semantic feedback colours – used by brand themes
    success: "#22c55e",
    error: "#DC2626",
    warning: "#FACC15",
    danger: "#DC2626",
 
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
        borderRadius: 12,
        transform: [{ rotate: "45deg" }],
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 2,
        elevation: 3,
    },
    pinIcon: {
        transform: [{ rotate: "-45deg" }],
    },
    pinSelected: {
        transform: [
            { rotate: "45deg" },
            { scale: 1.15 },
        ],
    },

};

