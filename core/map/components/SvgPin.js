import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@context/ThemeContext";
import theme from "@themes";
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
}) {
  // Use dynamic theme from context
  const dynamicTheme = useTheme();
  const theme = dynamicTheme;
  // Set defaults after theme is available
  if (fill === undefined) fill = theme.colors.primaryLight;
  if (stroke === undefined) stroke = theme.colors.primaryLight;
  if (circle === undefined) circle = theme.colors.accentDark;
  const iconSize = size * 0.45;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
      >
        {/* Pin body */}
        <Path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={fill}
          stroke={stroke}
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
    </View>
  );
}
