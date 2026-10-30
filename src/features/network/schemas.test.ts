import { describe, expect, it } from "vitest";
import {
  cleanText,
  hasActiveFilters,
  nameTerms,
  pageRange,
  parseDirectoryParams,
} from "@/features/network/schemas";

describe("cleanText", () => {
  it("removes LIKE wildcards and filter syntax and trims", () => {
    expect(cleanText("  a%b_c,(d)\\e*f\"g'h.i:j;k  ")).toBe("a b c d e f g h i j k");
  });
  it("caps the length and tolerates undefined", () => {
    expect(cleanText("x".repeat(200), 60)).toHaveLength(60);
    expect(cleanText(undefined)).toBe("");
  });
});

describe("nameTerms", () => {
  it("keeps at most three terms of thirty characters", () => {
    expect(nameTerms("a b c d")).toEqual(["a", "b", "c"]);
    expect(nameTerms("x".repeat(50))[0]).toHaveLength(30);
    expect(nameTerms("  ")).toEqual([]);
  });
});

describe("parseDirectoryParams", () => {
  it("reads valid filters", () => {
    expect(
      parseDirectoryParams({
        q: "ana",
        group: "researcher",
        field: "medicine",
        institution: "McGill",
        country: "CA",
        region: "Montreal",
        mentorship: "seeking",
        page: "2",
      }),
    ).toEqual({
      q: "ana",
      group: "researcher",
      field: "medicine",
      institution: "McGill",
      country: "CA",
      region: "Montreal",
      mentorship: "seeking",
      page: 2,
    });
  });

  it("drops unknown values instead of failing, so a stale link still opens", () => {
    const parsed = parseDirectoryParams({
      group: "wizard",
      field: "alchemy",
      country: "Canada",
      mentorship: "maybe",
      page: "abc",
    });
    expect(parsed).toMatchObject({ page: 1 });
    expect(parsed.group).toBeUndefined();
    expect(parsed.field).toBeUndefined();
    expect(parsed.country).toBeUndefined();
    expect(parsed.mentorship).toBeUndefined();
    expect(hasActiveFilters(parsed)).toBe(false);
  });

  it("keeps the page within sensible bounds and takes the first of repeated params", () => {
    expect(parseDirectoryParams({ page: "-4" }).page).toBe(1);
    expect(parseDirectoryParams({ page: "99999" }).page).toBe(500);
    expect(parseDirectoryParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("knows when any filter is active", () => {
    expect(hasActiveFilters(parseDirectoryParams({ q: "ana" }))).toBe(true);
    expect(hasActiveFilters(parseDirectoryParams({ mentorship: "offering" }))).toBe(true);
    expect(hasActiveFilters(parseDirectoryParams({ page: "3" }))).toBe(false);
  });
});

describe("pageRange", () => {
  it("computes inclusive row ranges", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 11 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });
});
