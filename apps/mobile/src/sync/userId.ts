/**
 * Web / Worker identity for x-user-id.
 * Always default to demo-user on Pages so screens hit the seeded Durable Object
 * without a manual Sync. Optional override via EXPO_PUBLIC_USER_ID or localStorage.
 */
export const DEMO_USER_ID = "demo-user";

const STORAGE_KEY = "copilot-user-id";

export function getApiUserId(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_USER_ID
      ? String(process.env.EXPO_PUBLIC_USER_ID).trim()
      : "";
  if (fromEnv) return fromEnv;

  if (typeof localStorage !== "undefined" && localStorage != null) {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)?.trim();
      if (existing) return existing;
      localStorage.setItem(STORAGE_KEY, DEMO_USER_ID);
    } catch {
      // private mode / blocked storage — still use demo-user
    }
  }

  return DEMO_USER_ID;
}
