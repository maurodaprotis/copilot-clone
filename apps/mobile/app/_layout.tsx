import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { handleIncomingUrl } from "../src/lib/deepLink";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";

export default function RootLayout() {
  useEffect(() => {
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

    // Best-effort sync when app opens (no-op if offline / empty outbox).
    void syncOutbox(createApiTransport()).catch(() => undefined);

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
