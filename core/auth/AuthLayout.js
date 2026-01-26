import theme from "@themes";
import { Text, View } from "react-native";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: "center",
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.xl * 2,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.primaryDark,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          elevation: 6,
        }}
      >
        <Text
          style={{
            color: theme.colors.accentMid,
            fontSize: theme.spacing.xl,
            fontWeight: "600",
            marginBottom: theme.spacing.sm,
          }}
        >
          {title}
        </Text>

        {subtitle && (
          <Text
            style={{
              color: theme.colors.textMuted,
              marginBottom: theme.spacing.lg,
            }}
          >
            {subtitle}
          </Text>
        )}

        {children}
      </View>
    </View>
  );
}
