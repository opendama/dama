import { describe, expect, it } from "vitest";
import { normalizeApiErrorPayload } from "./api-error-payload";
import { isRawApiJsonEnvelope } from "./api-toast-message";

describe("normalizeApiErrorPayload", () => {
  it("reads object error_key", () => {
    expect(
      normalizeApiErrorPayload({
        error: "Checkout failed",
        error_key: "checkout_unavailable",
      }),
    ).toEqual({ error: "Checkout failed", errorKey: "checkout_unavailable" });
  });

  it("parses JSON string envelopes", () => {
    expect(
      normalizeApiErrorPayload('{"error":"Checkout failed","error_key":"checkout_unavailable"}'),
    ).toEqual({ error: "Checkout failed", errorKey: "checkout_unavailable" });
  });

  it("ignores plain non-JSON strings", () => {
    expect(normalizeApiErrorPayload("boom")).toEqual({ error: "", errorKey: "" });
  });
});

describe("isRawApiJsonEnvelope", () => {
  it("detects checkout JSON envelopes", () => {
    expect(
      isRawApiJsonEnvelope('{"error":"Checkout failed","error_key":"checkout_unavailable"}'),
    ).toBe(true);
    expect(isRawApiJsonEnvelope("Checkout failed")).toBe(false);
  });
});
