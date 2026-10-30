/**
 * Medyra transactional email templates. Pure functions: they return a subject plus HTML and a
 * plain-text alternative, and never send anything.
 *
 * Authentication emails (sign-up confirmation, password recovery) are NOT built here. Supabase
 * Auth sends them (through Resend SMTP, see EMAIL_SETUP.md) using supabase/templates/*.html, so
 * there is exactly one system sending auth mail.
 */

export type EmailMessage = { subject: string; html: string; text: string };

/** Escape anything dynamic before it goes into HTML. Member names are user-supplied. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAROON = "#7a1f35";
const INK = "#2b1a20";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function layout(opts: { preheader: string; heading: string; body: string; footer?: string }): string {
  const { preheader, heading, body, footer } = opts;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#fbf7f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ead9dd;border-radius:16px;">
<tr><td style="padding:28px 32px 0;font-size:22px;font-weight:700;color:${MAROON};">Medyra</td></tr>
<tr><td style="padding:20px 32px 0;font-size:20px;font-weight:700;">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:12px 32px 28px;font-size:15px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:18px 32px 28px;border-top:1px solid #f0e4e7;font-size:12px;line-height:1.5;color:#6b5a5f;">
${footer ?? ""}Connect. Learn. Grow. Belong.<br>Medyra is a community space. It does not replace professional care, and posts are not verified medical advice.</td></tr>
</table></td></tr></table>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<p style="margin:20px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${MAROON};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(label)}</a></p>`;
}

const name = (firstName: string) => firstName.trim().slice(0, 60) || "there";

export function welcomeEmail(input: { firstName: string; username: string }): EmailMessage {
  const first = name(input.firstName);
  const profileUrl = `${siteUrl()}/profile/${encodeURIComponent(input.username)}`;
  return {
    subject: "Welcome to Medyra",
    html: layout({
      preheader: "Your Medyra profile is ready.",
      heading: `Welcome, ${first}`,
      body: `<p style="margin:0 0 12px;">Your Medyra profile is ready. You can share a post, explore other members, and say whether you are looking for or open to offering mentorship.</p>
<p style="margin:0;">A reminder as you start: never share information that could identify a patient or client. Profiles are self-reported and are not verified.</p>${button("Open your profile", profileUrl)}`,
    }),
    text: `Welcome to Medyra, ${first}.

Your profile is ready: ${profileUrl}

You can share a post, explore other members, and say whether you are looking for or open to offering mentorship. Never share information that could identify a patient or client. Profiles are self-reported and are not verified.

Connect. Learn. Grow. Belong.`,
  };
}

export type SecurityEvent =
  | "password_changed"
  | "mfa_added"
  | "mfa_removed"
  | "mfa_recovery_used";

const SECURITY_COPY: Record<SecurityEvent, { subject: string; line: string }> = {
  password_changed: {
    subject: "Your Medyra password was changed",
    line: "The password for your Medyra account was just changed, and your other devices were signed out.",
  },
  mfa_added: {
    subject: "An authenticator app was added to your Medyra account",
    line: "An authenticator app was just added to your Medyra account as a second sign-in step.",
  },
  mfa_removed: {
    subject: "An authenticator app was removed from your Medyra account",
    line: "An authenticator app was just removed from your Medyra account.",
  },
  mfa_recovery_used: {
    subject: "A recovery code was used on your Medyra account",
    line: "A recovery code was just used to reset the authenticator on your Medyra account.",
  },
};

export function securityNotificationEmail(input: {
  firstName: string;
  event: SecurityEvent;
}): EmailMessage {
  const first = name(input.firstName);
  const copy = SECURITY_COPY[input.event];
  const resetUrl = `${siteUrl()}/forgot-password`;
  return {
    subject: copy.subject,
    html: layout({
      preheader: copy.line,
      heading: "Account security notice",
      body: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 12px;">${escapeHtml(copy.line)}</p>
<p style="margin:0;"><strong>If this was you, no action is needed.</strong> If it was not, reset your password right away.</p>${button("Reset my password", resetUrl)}`,
    }),
    text: `Hi ${first},

${copy.line}

If this was you, no action is needed. If it was not, reset your password right away: ${resetUrl}`,
  };
}

/** Ready for the future comment-notification feature. Not sent by the app yet. */
export function commentNotificationEmail(input: {
  recipientFirstName: string;
  commenterName: string;
  postUrlPath: string;
}): EmailMessage {
  const first = name(input.recipientFirstName);
  const commenter = name(input.commenterName);
  const url = `${siteUrl()}${input.postUrlPath.startsWith("/") ? input.postUrlPath : `/${input.postUrlPath}`}`;
  const settings = `${siteUrl()}/settings`;
  return {
    subject: `${commenter} commented on your post`,
    html: layout({
      preheader: `${commenter} commented on your post.`,
      heading: "New comment on your post",
      body: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)}, ${escapeHtml(commenter)} commented on your post on Medyra.</p>${button("View the conversation", url)}`,
      footer: `You can turn these emails off in <a href="${escapeHtml(settings)}" style="color:${MAROON};">Settings</a>.<br>`,
    }),
    text: `Hi ${first}, ${commenter} commented on your post on Medyra.\n\nView the conversation: ${url}\n\nTurn these emails off in Settings: ${settings}`,
  };
}

/** Ready for the future connections feature. Not sent by the app yet. */
export function connectionNotificationEmail(input: {
  recipientFirstName: string;
  requesterName: string;
}): EmailMessage {
  const first = name(input.recipientFirstName);
  const requester = name(input.requesterName);
  const url = siteUrl();
  const settings = `${siteUrl()}/settings`;
  return {
    subject: `${requester} wants to connect on Medyra`,
    html: layout({
      preheader: `${requester} sent you a connection request.`,
      heading: "New connection request",
      body: `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)}, ${escapeHtml(requester)} would like to connect with you on Medyra.</p>${button("Open Medyra", url)}`,
      footer: `You can turn these emails off in <a href="${escapeHtml(settings)}" style="color:${MAROON};">Settings</a>.<br>`,
    }),
    text: `Hi ${first}, ${requester} would like to connect with you on Medyra.\n\nOpen Medyra: ${url}\n\nTurn these emails off in Settings: ${settings}`,
  };
}
