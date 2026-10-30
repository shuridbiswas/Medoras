import { describe, expect, it } from "vitest";
import { sniffImage } from "@/features/onboarding/avatar";
import { onboardingSchema, profileSchema } from "@/features/onboarding/schemas";

const valid = {
  memberType: "undergraduate_student",
  fields: ["psychology", "public_health"],
  institution: "University of Montreal",
  qualification: "BSc Psychology",
  specialty: "",
  careerStage: "student",
  country: "CA",
  city: "",
  purposes: ["find_mentor", "build_network"],
  username: "Amina_R",
  headline: "Psychology student",
  bio: "",
};

describe("onboardingSchema", () => {
  it("accepts a complete profile and normalizes the username", () => {
    const result = onboardingSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("amina_r");
      expect(result.data.specialty).toBeUndefined();
      expect(result.data.bio).toBeUndefined();
    }
  });

  it("rejects values outside the allowed lists", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, memberType: "wizard" }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...valid, fields: ["astrology"] }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...valid, country: "Canada" }).success,
    ).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, purposes: [] }).success).toBe(
      false,
    );
    expect(onboardingSchema.safeParse({ ...valid, fields: [] }).success).toBe(
      false,
    );
  });

  it("limits fields to five", () => {
    const six = [
      "nursing",
      "medicine",
      "psychology",
      "pharmacy",
      "audiology",
      "public_health",
    ];
    expect(onboardingSchema.safeParse({ ...valid, fields: six }).success).toBe(
      false,
    );
  });
});

describe("username rules", () => {
  it.each([
    "ab",
    "has space",
    "UPPER-dash",
    "x".repeat(31),
    "admin",
    "Medyra",
    "emoji😀name",
  ])("rejects %j", (username) => {
    expect(
      profileSchema.safeParse({ username, headline: "Student", bio: "" })
        .success,
    ).toBe(false);
  });

  it("requires a headline", () => {
    expect(
      profileSchema.safeParse({ username: "valid_name", headline: "", bio: "" })
        .success,
    ).toBe(false);
  });
});

describe("avatar content sniffing", () => {
  it("recognizes JPEG, PNG and WebP by their bytes", () => {
    expect(
      sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.contentType,
    ).toBe("image/jpeg");
    expect(
      sniffImage(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )?.contentType,
    ).toBe("image/png");
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImage(webp)?.contentType).toBe("image/webp");
  });

  it("rejects other content even if it claims to be an image", () => {
    const text = new TextEncoder().encode("<svg onload=alert(1)>");
    expect(sniffImage(text)).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});
