import { MaterialIcons } from "@expo/vector-icons";
import theme from "@themes";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const PIN_SIZE = 38;
const INNER_RADIUS = 6;
const ICON_OFFSET = 0.16;
const STROKE_WIDTH = 1.2;

export default function SvgPin({
  size = PIN_SIZE,
  fill = theme.colors.accentLight,
  stroke = theme.colors.accenntMid,
  icon = "local-cafe",
  iconColor = "#000",
}) {
  const iconSize = size * 0.45;

  return (
    <View style={{ alignItems: "center" }}>
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
          strokeWidth={STROKE_WIDTH}
        />

        {/* Inner dot */}
        <Circle
          cx="12"
          cy="9"
          r={INNER_RADIUS}
          fill="#fff"
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
        <MaterialIcons
          name={icon}
          size={iconSize}
          color={iconColor}
        />
      </View>
    </View>
  );
}
