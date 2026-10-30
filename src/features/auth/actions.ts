"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  NOT_CONFIGURED_MESSAGE,
} from "@/lib/supabase/env";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/session-cookie";
import { getUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { sendToMember } from "@/lib/email/send";
import { securityNotificationEmail } from "@/lib/email/templates";
import { siteConfig } from "@/lib/site";
import {
  flattenErrors,
  forgotPasswordSchema,
  loginSchema,
  resendSchema,
  resetPasswordSchema,
  signupSchema,
  type AuthFormState,
} from "@/features/auth/schemas";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const redirectTo = (path: string) =>
  `${siteConfig.url}/auth/callback?next=${path}`;

const notConfigured: AuthFormState = {
  status: "error",
  message: NOT_CONFIGURED_MESSAGE,
};

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on",
  };
  const values = {
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: flattenErrors(parsed.error),
      values,
    };
  }
  if (!isSupabaseConfigured()) return { ...notConfigured, values };

  const { firstName, lastName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo("/onboarding"),
      data: { first_name: firstName, last_name: lastName },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        values,
        fieldErrors: { password: [error.message] },
      };
    }
    // An address that is already registered gets the same screen as a new one, so the
    // form cannot be used to discover who has an account.
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      return {
        status: "error",
        values,
        message:
          error.code === "over_email_send_rate_limit"
            ? "Too many emails have been sent. Please wait a few minutes and try again."
            : GENERIC_ERROR,
      };
    }
  }

  // With email confirmation turned off (development projects), Supabase signs the new member
  // in immediately. Skip the "check your inbox" screen and continue to onboarding.
  if (data?.session) redirect("/onboarding");

  // Note: when the address is already registered and confirmations are on, Supabase also
  // returns success with no identities and sends no new account. Same screen again.
  return { status: "success", email };
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: text(formData, "email"),
    password: text(formData, "password"),
    remember: formData.get("remember") === "on",
  };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: flattenErrors(parsed.error),
      values,
    };
  }
  if (!isSupabaseConfigured()) return { ...notConfigured, values };

  const { email, password, remember } = parsed.data;
  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(SESSION_ONLY_COOKIE);
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  const supabase = await createClient({ sessionOnly: !remember });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        values,
        needsVerification: true,
        email,
        message: "Please verify your email address before signing in.",
      };
    }
    // One message for unknown email and wrong password.
    if (error.code === "invalid_credentials") {
      return {
        status: "error",
        values,
        message: "Incorrect email or password.",
      };
    }
    return { status: "error", values, message: GENERIC_ERROR };
  }

  redirect(safeNextPath(text(formData, "next")));
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: text(formData, "email"),
  });
  const values = { email: text(formData, "email") };
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: flattenErrors(parsed.error),
      values,
    };
  }
  if (!isSupabaseConfigured()) return { ...notConfigured, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: redirectTo("/reset-password"),
    },
  );

  // Only rate limiting is reported; everything else looks identical so accounts can't be probed.
  if (error?.code === "over_email_send_rate_limit") {
    return {
      status: "error",
      values,
      message: "Too many requests. Please wait a few minutes and try again.",
    };
  }
  return { status: "success", email: parsed.data.email };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }
  if (!isSupabaseConfigured()) return notConfigured;

  // The recovery link signs the member in; without that session there is nothing to update.
  const user = await getUser();
  if (!user) redirect("/forgot-password?error=link_invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "same_password") {
      return {
        status: "error",
        fieldErrors: {
          password: ["Choose a password you haven't used before."],
        },
      };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] } };
    }
    return { status: "error", message: GENERIC_ERROR };
  }

  // Sign out every other device that still holds an old session.
  await supabase.auth.signOut({ scope: "others" });

  // Tell the member, so a hijacked account is noticed. Best effort; never blocks the change.
  await sendToMember(
    user,
    securityNotificationEmail({
      firstName: String(user.user_metadata?.first_name ?? ""),
      event: "password_changed",
    }),
    "security",
  );
  redirect("/home");
}

export async function resendVerification(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resendSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!isSupabaseConfigured()) return notConfigured;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo("/onboarding") },
  });
  if (error?.code === "over_email_send_rate_limit") {
    return {
      status: "error",
      message: "Please wait a minute before requesting another email.",
    };
  }
  return {
    status: "success",
    email: parsed.data.email,
    message: "If that address needs verifying, a new email is on its way.",
  };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  redirect("/");
}
