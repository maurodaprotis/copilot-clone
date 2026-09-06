import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { handleIncomingUrl } from "../src/lib/deepLink";
import { syncOutbox } from "../src/offline/syncOutbox";
import { ensureWebOutboxAutodrain } from "../src/offline/webOutbox";
import { createApiTransport } from "../src/sync/apiTransport";
import { prefetchWebApiData } from "../src/sync/prefetchWebData";
import { getApiUserId } from "../src/sync/userId";
import { colors, fontFamily } from "../src/theme";
import { WebShell } from "../src/ui";

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

    // Ensure web identity is demo-user (or configured) before any GETs.
    getApiUserId();

    void syncOutbox(createApiTransport()).catch(() => undefined);

    // Web: warm categories/transactions/accounts/dashboard so tabs are populated
    // without tapping Sync (Worker already has demo seed).
    void prefetchWebApiData().catch(() => undefined);

    // Web: auto-drain localStorage outbox on online / focus (no manual Sync needed).
    ensureWebOutboxAutodrain(() => createApiTransport());

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <WebShell>
        <Stack screenOptions={headerOpts}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
          <Stack.Screen name="investments" options={{ title: "Investments", headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
              presentation: "transparentModal",
              animation: "fade",
              contentStyle: { backgroundColor: "transparent" },
              headerShown: false,
            }}
          />
          <Stack.Screen name="import" options={{ title: "Import" }} />
          <Stack.Screen name="rules" options={{ title: "Name Rules" }} />
          <Stack.Screen name="tags" options={{ title: "Tags" }} />
          <Stack.Screen name="recurrings" options={{ title: "Recurrings" }} />
        </Stack>
      </WebShell>
    </>
  );
}
