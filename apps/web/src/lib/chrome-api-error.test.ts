import { describe, expect, it } from "vitest";
import { extractApiErrorMessage, isDocKycIncompleteError } from "./chrome-api-error";

describe("extractApiErrorMessage", () => {
  it("unwraps JSON error envelopes", () => {
    expect(
      extractApiErrorMessage('{"error":"complete identity documents before submitting"}'),
    ).toBe("complete identity documents before submitting");
  });

  it("reads object.error", () => {
    expect(extractApiErrorMessage({ error: "Unable to save identity documents" })).toBe(
      "Unable to save identity documents",
    );
  });

  it("passes through plain chrome strings", () => {
    expect(extractApiErrorMessage("Complete all required identity fields before submitting.")).toBe(
      "Complete all required identity fields before submitting.",
    );
  });
});

describe("isDocKycIncompleteError", () => {
  it("matches current and legacy incomplete copy", () => {
    expect(
      isDocKycIncompleteError(
        "Complete all required identity fields before submitting.",
        "Complete all required identity fields before submitting.",
      ),
    ).toBe(true);
    expect(
      isDocKycIncompleteError(
        "complete identity documents before submitting",
        "Complete all required identity fields before submitting.",
      ),
    ).toBe(true);
    expect(
      isDocKycIncompleteError(
        '{"error":"complete identity documents before submitting"}',
        "Complete all required identity fields before submitting.",
      ),
    ).toBe(true);
  });

  it("rejects unrelated failed copy", () => {
    expect(
      isDocKycIncompleteError(
        "Unable to save identity documents",
        "Complete all required identity fields before submitting.",
      ),
    ).toBe(false);
  });
});
