import { describe, expect, it } from "vitest";
import {
  dateToMonth,
  educationEntrySchema,
  experienceEntrySchema,
  monthToDate,
  skillsSchema,
  tagSchema,
  basicsSchema,
} from "@/features/profile/schemas";
import {
  formatMonthRange,
  formatYearRange,
  generalLocation,
} from "@/features/profile/format";
import {
  PUBLIC_PROFILE_FIELDS,
  toPublicProfile,
} from "@/features/profile/visibility";
import type { ProfileRow } from "@/lib/supabase/database.types";

describe("education entry validation", () => {
  const base = {
    id: "",
    institution: "McGill",
    qualification: "BScN",
    fieldOfStudy: "",
    startYear: "2022",
    endYear: "",
    currentlyStudying: false,
    description: "",
  };

  it("accepts a minimal entry and turns blanks into undefined", () => {
    const r = educationEntrySchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success)
      expect(r.data).toMatchObject({
        id: undefined,
        fieldOfStudy: undefined,
        startYear: 2022,
        endYear: undefined,
      });
  });

  it.each([["12"], ["abcd"], ["1800"], ["2200"]])(
    "rejects the year %j",
    (year) => {
      expect(
        educationEntrySchema.safeParse({ ...base, startYear: year }).success,
      ).toBe(false);
    },
  );

  it("rejects an end year before the start year but ignores it for a current program", () => {
    expect(
      educationEntrySchema.safeParse({ ...base, endYear: "2020" }).success,
    ).toBe(false);
    const current = educationEntrySchema.safeParse({
      ...base,
      endYear: "2020",
      currentlyStudying: true,
    });
    expect(current.success).toBe(true);
    if (current.success) expect(current.data.endYear).toBeUndefined();
  });

  it("rejects markup and malformed ids", () => {
    expect(
      educationEntrySchema.safeParse({ ...base, institution: "<script>" })
        .success,
    ).toBe(false);
    expect(
      educationEntrySchema.safeParse({ ...base, id: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("experience entry validation", () => {
  const base = {
    id: "",
    title: "RN",
    organization: "CHUM",
    employmentType: "",
    startMonth: "2024-05",
    endMonth: "",
    isCurrent: false,
    description: "",
  };

  it("accepts valid entries and converts months to dates", () => {
    expect(
      experienceEntrySchema.safeParse({ ...base, employmentType: "full_time" })
        .success,
    ).toBe(true);
    expect(monthToDate("2024-05")).toBe("2024-05-01");
    expect(dateToMonth("2024-05-01")).toBe("2024-05");
    expect(dateToMonth(null)).toBe("");
  });

  it("rejects bad months, unknown employment types and reversed dates", () => {
    expect(
      experienceEntrySchema.safeParse({ ...base, startMonth: "2024-13" })
        .success,
    ).toBe(false);
    expect(
      experienceEntrySchema.safeParse({ ...base, startMonth: "" }).success,
    ).toBe(false);
    expect(
      experienceEntrySchema.safeParse({ ...base, employmentType: "pirate" })
        .success,
    ).toBe(false);
    expect(
      experienceEntrySchema.safeParse({ ...base, endMonth: "2023-01" }).success,
    ).toBe(false);
  });

  it("drops the end date for a current position", () => {
    const r = experienceEntrySchema.safeParse({
      ...base,
      isCurrent: true,
      endMonth: "2020-01",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.endMonth).toBeUndefined();
  });
});

describe("tags and basics", () => {
  it("normalizes whitespace and rejects markup or tiny tags", () => {
    expect(tagSchema.parse("  Active   listening ")).toBe("Active listening");
    expect(tagSchema.safeParse("a").success).toBe(false);
    expect(tagSchema.safeParse("<b>x</b>").success).toBe(false);
    expect(tagSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(skillsSchema.safeParse({ kind: "badge", names: [] }).success).toBe(
      false,
    );
  });

  it("requires the essentials but not the location", () => {
    const ok = basicsSchema.safeParse({
      firstName: "A",
      lastName: "B",
      headline: "Student nurse",
      locationLabel: "",
      memberType: "other",
      fields: ["nursing"],
      institution: "X",
      qualification: "Y",
      specialty: "",
      careerStage: "student",
    });
    expect(ok.success).toBe(true);
  });
});

describe("date and location formatting", () => {
  it("formats without timezone shifts", () => {
    expect(formatMonthRange("2024-05-01", null, true)).toBe(
      "May 2024 to Present",
    );
    expect(formatMonthRange("2024-01-01", "2024-12-01", false)).toBe(
      "Jan 2024 to Dec 2024",
    );
    expect(formatYearRange(2022, null, true)).toBe("2022 to Present");
    expect(formatYearRange(null, null, false)).toBeNull();
  });

  it("shows only a general location", () => {
    expect(generalLocation("Montreal, QC", "CA")).toBe("Montreal, QC, Canada");
    expect(generalLocation(null, "CA")).toBe("Canada");
    expect(generalLocation(null, null)).toBeNull();
  });
});

describe("public profile projection", () => {
  const row = {
    id: "u1",
    username: "amina_r",
    first_name: "Amina",
    last_name: "R",
    headline: null,
    bio: null,
    avatar_path: null,
    cover_path: null,
    location_label: null,
    professional_journey: null,
    career_aspirations: null,
    looking_for_mentorship: false,
    open_to_mentor: false,
    member_type: null,
    fields: [],
    institution: null,
    qualification: null,
    specialty: null,
    career_stage: null,
    country: null,
    onboarding_completed: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    // Columns that must never leak even if they appear on the row someday.
    email: "amina@example.com",
    private_note: "secret",
  } as unknown as ProfileRow;

  it("keeps only whitelisted fields", () => {
    const pub = toPublicProfile(row) as Record<string, unknown>;
    expect(Object.keys(pub).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
    expect(pub).not.toHaveProperty("email");
    expect(pub).not.toHaveProperty("private_note");
    expect(pub).not.toHaveProperty("onboarding_completed");
  });
});
