import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateFeatureFlags } from "./invalidate";

describe("invalidateFeatureFlags", () => {
  it("also invalidates events catalog + public list (Community / Host Public)", async () => {
    const keys: string[][] = [];
    const qc = {
      invalidateQueries: vi.fn(({ queryKey }: { queryKey: string[] }) => {
        keys.push(queryKey);
        return Promise.resolve();
      }),
    } as unknown as QueryClient;

    await invalidateFeatureFlags(qc);

    expect(keys).toEqual(
      expect.arrayContaining([
        ["feature-flags"],
        ["rest-feature-flags"],
        ["events-catalog"],
        ["events-public-list"],
      ]),
    );
  });
});
