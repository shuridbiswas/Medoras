import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library's automatic cleanup must be registered by hand.
afterEach(() => cleanup());

// MFA is enforced by default; the many tests that are not about MFA run with it off.
process.env.MFA_ENFORCEMENT ??= "off";
