import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { handleIncomingUrl } from "../src/lib/deepLink";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";
import { colors, fontFamily } from "../src/theme";

const headerOpts = {
  headerStyle: {
    backgroundColor: colors.bgPage,
  },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  headerTitleStyle: {
    fontWeight: "700" as const,
    color: colors.text,
    fontFamily,
    fontSize: 17,
  },
  headerBackTitle: "Back",
  contentStyle: { backgroundColor: colors.bgPage },
};

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = colors.bg;
      document.body.style.fontFamily =
        fontFamily ??
        "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      // Load Inter on web when available
      const id = "copilot-inter-font";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
        document.head.appendChild(link);
      }
    }

    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleIncomingUrl(url).then((handled) => {
        if (handled) {
          void syncOutbox(createApiTransport()).catch(() => {
            // offline is fine — outbox retains the row
          });
        }
      });
    });

    void Linking.getInitialURL().then((url) => {
      if (url) void handleIncomingUrl(url);
    });

    void syncOutbox(createApiTransport()).catch(() => undefined);

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={headerOpts}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
            presentation: "modal",
          }}
        />
        <Stack.Screen name="import" options={{ title: "Import" }} />
        <Stack.Screen name="rules" options={{ title: "Name Rules" }} />
        <Stack.Screen name="tags" options={{ title: "Tags" }} />
        <Stack.Screen name="recurrings" options={{ title: "Recurrings" }} />
      </Stack>
    </>
  );
}
