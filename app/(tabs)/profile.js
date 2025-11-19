import { useContext } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Header } from "../../components/layout/Header";
import { globalStyles } from "../../config/globalStyles";
import { theme } from "../../config/theme";
import { AuthContext } from "../../context/AuthContext";
import { pickImageSquare } from "../../lib/imagePicker";

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);
  const role = user?.role || "guest";
  const photo = user?.photoURL;

  const handleChangePhoto = async () => {
    const uri = await pickImageSquare();
      if (!uri) return;  
    };

return (
  <View style={globalStyles.screenStandard }>
    <Header mode="icon-title" title="Profile" />    
    <View style={{ width: "100%", alignItems: "center", backgroundColor: theme.colors.background }}>

      {/* Content */}
      <View style={{ width: "100%", alignItems: "center", backgroundColor: theme.colors.background }}>

        {/* Profile Image */}
        <TouchableOpacity onPress={handleChangePhoto} style={{ alignItems: "center" }}>
          <Image
            source={
              photo
                ? { uri: photo }
                : require("../../assets/default-user.png") // make sure you have one, or swap this path
            }
            style={{
              width: 120,
              height: 120,
              borderRadius: theme.radius.round,
              borderWidth: 2,
              borderColor: theme.colors.border,
            }}
          />

          <Text
            style={{
              marginTop: theme.spacing.sm,
              color: theme.colors.textMuted,
              fontSize: 14,
            }}
          >
            Change Photo
          </Text>
        </TouchableOpacity>

        {/* Name */}
        <Text
          style={{
            fontSize: 26,
            fontWeight: "700",
            color: theme.colors.placeholder,
            marginTop: theme.spacing.lg,
          }}
        >
          {user?.displayName || "Tim Marler"}
        </Text>

        {/* Email */}
        <Text
          style={{
            fontSize: 16,
            color: theme.colors.textMuted,
            marginTop: theme.spacing.xs,
          }}
        >
          {user?.email || ""}
        </Text>

        {/* Role Badge */}
        <View
          style={{
            marginTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radius.sm,
            backgroundColor: getRoleColor(role),
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {role.toUpperCase()}
          </Text>
        </View>

        {/* Logout button */}
        <TouchableOpacity
          onPress={logout}
          style={{
            marginTop: theme.spacing.xl,
            backgroundColor: theme.colors.danger,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.md,
          }}
        >
          <Text
            style={{
              color: theme.colors.surface,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            Log out
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  </View>
  );
}

function getRoleColor(role) {
  switch (role) {
    case "admin":
      return theme.colors.danger;
    case "pro":
      return theme.colors.accent; // gold/latte tone fits pro nicely
    case "user":
      return theme.colors.primaryLight;
    default:
      return theme.colors.surface;
  }
}
