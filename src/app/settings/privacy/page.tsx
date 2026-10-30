import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { POLICY_DOCS, POLICY_VERSION, privacyContact } from "@/lib/legal";
import { DeletionPanel, PrivacySettingsForm } from "@/features/privacy/components/privacy-forms";
import type { ConsentRecordRow, DataRequestRow, RetentionPolicyRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Privacy and your data",
  robots: { index: false },
};

export default function PrivacySettingsPage() {
  return (
    <AppPage label="privacy settings">
      <PrivacyContent />
    </AppPage>
  );
}

const section = "rounded-2xl border border-border bg-surface p-5 sm:p-7";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

async function PrivacyContent() {
  const { user, profile } = await requireMember();
  const supabase = await createClient();
  const [requests, consents, retention] = await Promise.all([
    supabase
      .from("data_requests")
      .select("id, kind, status, requested_at, scheduled_for, completed_at, user_id")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(10)
      .overrideTypes<DataRequestRow[], { merge: false }>(),
    supabase
      .from("consent_records")
      .select("id, user_id, kind, version, accepted_at")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .overrideTypes<ConsentRecordRow[], { merge: false }>(),
    supabase
      .from("retention_policies")
      .select("key, days, description")
      .order("key", { ascending: true })
      .overrideTypes<RetentionPolicyRow[], { merge: false }>(),
  ]);
  const openDeletion = (requests.data ?? []).find((r) => r.kind === "deletion" && r.status === "requested");
  const contact = privacyContact();

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <Link href="/settings" className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline">
            Back to settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-maroon-900">Privacy and your data</h1>
          <p className="mt-1 text-muted-foreground">Control who sees your profile, download your data, or delete your account.</p>
        </div>

        <section aria-labelledby="visibility" className={section}>
          <h2 id="visibility" className="text-xl font-bold text-maroon-900">
            Profile visibility
          </h2>
          <div className="mt-4">
            <PrivacySettingsForm profileVisibility={profile.profile_visibility ?? "members"} directoryListed={profile.directory_listed ?? true} />
          </div>
        </section>

        <section aria-labelledby="export" className={section}>
          <h2 id="export" className="text-xl font-bold text-maroon-900">
            Download your data
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            A JSON file with your profile, posts, comments, connections, settings and records. It is generated when you
            ask, includes only your own information, and needs a recent sign-in.
          </p>
          <form method="post" action="/settings/privacy/export">
            <Button type="submit" variant="outline" className="h-10 px-4">
              <Download className="size-4" aria-hidden="true" />
              Download my data
            </Button>
          </form>
        </section>

        <section aria-labelledby="deletion" className={section}>
          <h2 id="deletion" className="text-xl font-bold text-maroon-900">
            Delete your account
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Deletion happens after a 30-day waiting period so a mistake or a hijacked session can be undone. Reports you
            filed or that were filed about you, and records of moderation decisions, are kept for the periods below.
          </p>
          <DeletionPanel pending={openDeletion ? { id: openDeletion.id, scheduledFor: day(openDeletion.scheduled_for) } : null} />
        </section>

        <section aria-labelledby="consents" className={section}>
          <h2 id="consents" className="text-xl font-bold text-maroon-900">
            What you agreed to
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current drafts are version <code>{POLICY_VERSION}</code>. They have not been reviewed by a lawyer yet.
          </p>
          {(consents.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No acceptance is recorded for your account yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {(consents.data ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{POLICY_DOCS.find((d) => d.kind === c.kind)?.label ?? c.kind}</span>
                  <span className="text-muted-foreground">
                    version {c.version}, {day(c.accepted_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            Read:{" "}
            {POLICY_DOCS.map((d, i) => (
              <span key={d.kind}>
                {i > 0 ? ", " : ""}
                <Link href={d.href} className="font-medium text-maroon-700 underline underline-offset-2">
                  {d.label}
                </Link>
              </span>
            ))}
          </p>
        </section>

        <section aria-labelledby="retention" className={section}>
          <h2 id="retention" className="text-xl font-bold text-maroon-900">
            How long we keep things
          </h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {(retention.data ?? []).map((p) => (
              <li key={p.key} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{p.description}</span>
                <span className="font-medium text-maroon-900">{p.days} days</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Your own posts, comments and profile stay until you delete them or your account.
          </p>
        </section>

        <section aria-labelledby="contact" className={section}>
          <h2 id="contact" className="text-xl font-bold text-maroon-900">
            Privacy contact
          </h2>
          {contact.email ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Questions, corrections or complaints about your personal information:{" "}
              <a href={`mailto:${contact.email}`} className="font-medium text-maroon-700 underline underline-offset-2">
                {contact.email}
              </a>
              .
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              A privacy contact has not been set up yet. Until it is, use the{" "}
              <Link href="/contact" className="font-medium text-maroon-700 underline underline-offset-2">
                contact page
              </Link>
              .
            </p>
          )}
        </section>
      </main>
    </>
  );
}
