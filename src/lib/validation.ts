import { z } from "zod";

/** Shared zod building blocks for user-entered text. */

const noMarkup = /^[^<>]*$/;

export const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(max, `Use ${max} characters or fewer.`)
    .regex(noMarkup, "Remove < and > characters.");

/** Empty input becomes undefined, so optional fields can be cleared. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .regex(noMarkup, "Remove < and > characters.")
    .transform((v) => (v === "" ? undefined : v))
    .optional();
