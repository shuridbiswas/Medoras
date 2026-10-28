import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas";

const validSignup = {
  firstName: "Amina",
  lastName: "Rahman",
  email: "Amina@Example.com ",
  password: "correct-horse-9",
  confirmPassword: "correct-horse-9",
  acceptTerms: true,
};

describe("signupSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const result = signupSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("amina@example.com");
  });

  it("requires agreeing to the terms", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "different-9999",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it.each([
    ["short", "abc123"],
    ["no number", "abcdefghijkl"],
    ["no letter", "1234567890123"],
    ["too long", "a1".repeat(40)],
  ])("rejects a weak password (%s)", (_label, password) => {
    expect(
      signupSchema.safeParse({
        ...validSignup,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid emails and markup in names", () => {
    expect(
      signupSchema.safeParse({ ...validSignup, email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...validSignup, firstName: "<script>" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...validSignup, lastName: "" }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email and any non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "x", remember: true })
        .success,
    ).toBe(true);
  });

  it("rejects empty fields", () => {
    expect(
      loginSchema.safeParse({ email: "", password: "", remember: false })
        .success,
    ).toBe(false);
  });
});

describe("forgot and reset password schemas", () => {
  it("validates the email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(
      true,
    );
  });

  it("applies the same password rules on reset", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short1",
        confirmPassword: "short1",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        password: "brand-new-pass1",
        confirmPassword: "brand-new-pass1",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: "brand-new-pass1",
        confirmPassword: "mismatch",
      }).success,
    ).toBe(false);
  });
});
