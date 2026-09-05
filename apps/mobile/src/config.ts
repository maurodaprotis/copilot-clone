import Constants from "expo-constants";
import { DEMO_USER_ID as DEMO_USER_ID_SYNC } from "./sync/userId";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
};

/**
 * Public Worker URL. Override with EXPO_PUBLIC_API_URL at build/start time.
 * Default points at the Cloudflare preview Worker for Paul.
 */
export const API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  extra.apiUrl ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";

export const DEMO_USER_ID = DEMO_USER_ID_SYNC;
export { getApiUserId } from "./sync/userId";
export const DEMO_ACCOUNT_ID = "acc-cash-ars";
export const DEMO_ACCOUNT_CURRENCY = "ARS";
export const DEMO_REPORTING_CURRENCY = "USD";
