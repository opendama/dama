import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { catalogHostedFeatureOff } from "./events-catalog-gate";

function axiosStatus(status: number) {
  return new AxiosError("x", "ERR", undefined, undefined, {
    status,
    statusText: "x",
    headers: {},
    config: {} as never,
    data: { error: "off" },
  });
}

describe("catalogHostedFeatureOff", () => {
  it("gates when hosted_events_enabled is false", () => {
    expect(catalogHostedFeatureOff({ hosted_events_enabled: false } as never, null)).toBe(true);
  });

  it("does not gate when hosted_events_enabled is true or missing", () => {
    expect(catalogHostedFeatureOff({ hosted_events_enabled: true } as never, null)).toBe(false);
    expect(catalogHostedFeatureOff({} as never, null)).toBe(false);
    expect(catalogHostedFeatureOff(undefined, null)).toBe(false);
  });

  it("gates on catalog HTTP 503 only", () => {
    expect(catalogHostedFeatureOff(undefined, axiosStatus(503))).toBe(true);
    expect(catalogHostedFeatureOff(undefined, axiosStatus(500))).toBe(false);
    expect(catalogHostedFeatureOff(undefined, new Error("network"))).toBe(false);
  });
});
