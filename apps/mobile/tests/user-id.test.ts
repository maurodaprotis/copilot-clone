import { describe, expect, it } from "vitest";
import { DEMO_USER_ID, getApiUserId } from "../src/sync/userId";

describe("getApiUserId", () => {
  it("defaults to demo-user", () => {
    expect(DEMO_USER_ID).toBe("demo-user");
    expect(getApiUserId()).toBe("demo-user");
  });
});
