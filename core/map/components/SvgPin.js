import { useTheme } from "@context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const PIN_SIZE = 36;
const INNER_RADIUS = 6;
const ICON_OFFSET = 0.16;
const STROKE_WIDTH = 1.2;
//const CIRCLE_FILL = theme.colors.accentDark;


export default function SvgPin({
  size = PIN_SIZE,
  fill,
  stroke,
  circle,
  icon = "map-marker",
  iconColor = "#000",
  strokeWidth = STROKE_WIDTH,
  visited = false,
}) {
  // Use dynamic theme from context
  const dynamicTheme = useTheme();
  const theme = dynamicTheme;
  // Set defaults after theme is available
  if (fill === undefined) fill = theme.colors.primaryLight;
  if (stroke === undefined) stroke = theme.colors.primaryLight;
  if (circle === undefined) circle = theme.colors.accentDark;
  const iconSize = size * 0.45;

  const visitedStroke = "#10b981"; // emerald, softer green

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
      >
        {/* Visited outer edge — rendered behind the pin body */}
        {visited && (
          <Path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="none"
            stroke={visitedStroke}
            strokeWidth={strokeWidth + 2.2}
          />
        )}

        {/* Pin body */}
        <Path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={fill}
          stroke={visited ? visitedStroke : stroke}
          strokeWidth={strokeWidth}
        />

        {/* Inner dot */}
        <Circle
          cx="12"
          cy="9"
          r={INNER_RADIUS}
          fill={circle}
          opacity={0.9}
        />
      </Svg>

      {/* Icon overlay */}
      <View
        style={{
          position: "absolute",
          top: size * ICON_OFFSET,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={iconSize}
          color={iconColor}
        />
      </View>

      {/* Visited badge — small green checkmark dot at top-right */}
      {visited && (
        <View
          style={{
            position: "absolute",
            top: -1,
            right: -1,
            width: Math.round(size * 0.28),
            height: Math.round(size * 0.28),
            borderRadius: Math.round(size * 0.14),
            backgroundColor: visitedStroke,
            borderWidth: 1.5,
            borderColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name="check"
            size={Math.round(size * 0.17)}
            color="#fff"
            style={{ marginTop: -1 }}
          />
        </View>
      )}
    </View>
  );
}
