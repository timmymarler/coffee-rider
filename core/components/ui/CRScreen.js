// core/components/ui/CRScreen.js

import theme from "@themes";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function CRScreen({
  children,
  scroll = false,      // scrollable screen?
  padded = true,        // apply screen padding?
  style,
  contentContainerStyle,
}) {

  const Wrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.primaryBackground,
        },
        style,
      ]}
    >
      <Wrapper
        contentContainerStyle={
          scroll
            ? [
                {
                  padding: padded ? theme.spacing.lg : 0,
                },
                contentContainerStyle,
              ]
            : undefined
        }
        style={!scroll && padded ? { padding: theme.spacing.lg } : null}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
