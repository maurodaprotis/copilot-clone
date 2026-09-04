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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="import" options={{ title: "Import CSV" }} />
        <Stack.Screen name="rules" options={{ title: "Name Rules" }} />
        <Stack.Screen name="tags" options={{ title: "Tags" }} />
        <Stack.Screen name="recurrings" options={{ title: "Recurrings" }} />
      </Stack>
    </>
  );
}
