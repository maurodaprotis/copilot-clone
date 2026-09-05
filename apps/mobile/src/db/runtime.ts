/**
 * Platform detection without importing react-native (keeps vitest/node happy).
 * Expo web / Cloudflare Pages expose `document`; native RN and vitest do not.
 */
export function isWebRuntime(): boolean {
  return typeof document !== "undefined";
}
