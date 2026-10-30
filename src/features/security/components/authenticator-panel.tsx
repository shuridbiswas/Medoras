"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  createRecoveryCodes,
  removeFactor,
  startTotpEnrollment,
  verifyTotpEnrollment,
} from "@/features/security/actions";

export type FactorSummary = { id: string; name: string; createdAt: string };

type Setup = { factorId: string; qrCode: string; secret: string };

/**
 * Authenticator apps and recovery codes. Setup walks through scan, confirm, and then shows the
 * recovery codes once. Anything needing a recent sign-in sends the member to /reauth.
 */
export function AuthenticatorPanel({
  factors,
  recoveryRemaining,
  required,
  autoStart = false,
}: {
  factors: FactorSummary[];
  /** Unused recovery codes left, or null when none were ever created. */
  recoveryRemaining: number | null;
  required: boolean;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const returnTo = "/settings/security";
  const reauth = () => router.push(`/reauth?next=${encodeURIComponent(returnTo)}`);

  function begin() {
    setError(null);
    startTransition(async () => {
      const result = await startTotpEnrollment();
      if (result.ok) setSetup({ factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
      else setError(result.error);
    });
  }

  function confirm() {
    if (!setup) return;
    setError(null);
    startTransition(async () => {
      const verified = await verifyTotpEnrollment(setup.factorId, code);
      if (!verified.ok) return setError(verified.error);
      setSetup(null);
      setCode("");
      const created = await createRecoveryCodes();
      if (created.ok) setCodes(created.codes);
      else if (created.reauth) setError("Authenticator added. Create recovery codes next: confirm your password first.");
      else setError(created.error);
      router.refresh();
    });
  }

  function newCodes() {
    setError(null);
    startTransition(async () => {
      const created = await createRecoveryCodes();
      if (created.ok) {
        setCodes(created.codes);
        router.refresh();
      } else if (created.reauth) reauth();
      else setError(created.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeFactor(id);
      if (result.ok) router.refresh();
      else if (result.reauth) reauth();
      else setError(result.error);
    });
  }

  function download() {
    if (!codes) return;
    const blob = new Blob(
      [`Medyra recovery codes\nEach code works once. Keep them somewhere safe and private.\n\n${codes.join("\n")}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "medyra-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      <section aria-labelledby="authenticator" className="space-y-4">
        <h3 id="authenticator" className="flex items-center gap-2 font-semibold text-maroon-900">
          <Smartphone className="size-4.5 text-maroon-600" aria-hidden="true" />
          Authenticator app
        </h3>

        {factors.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <span className="flex items-center gap-2 text-maroon-900">
                  <ShieldCheck className="size-4 text-maroon-600" aria-hidden="true" />
                  {f.name}
                  <span className="text-xs text-muted-foreground">added {f.createdAt}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => remove(f.id)}
                  className="h-9 px-3 text-sm"
                  aria-label={`Remove ${f.name}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {required
              ? "An authenticator app is required to use Medyra. It adds a 6-digit code to every sign-in."
              : "Add an authenticator app to protect your account with a 6-digit code at sign-in."}
          </p>
        )}

        {setup ? (
          <div className="space-y-4 rounded-xl border border-maroon-200 bg-maroon-50/60 p-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-maroon-900/85">
              <li>Open an authenticator app (any app that supports TOTP).</li>
              <li>Scan this code, or type the key by hand.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrCode} alt="QR code for your authenticator app" className="size-40 rounded-lg bg-white p-2" />
              <div className="min-w-0 text-sm">
                <p className="text-muted-foreground">Setup key</p>
                <p className="font-mono text-base break-all text-maroon-900" data-testid="setup-secret">
                  {setup.secret}
                </p>
              </div>
            </div>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              <div>
                <label htmlFor="enroll-code" className="mb-1 block text-xs font-semibold text-maroon-900">
                  6-digit code
                </label>
                <input
                  id="enroll-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-10 w-36 rounded-lg border border-input bg-surface px-3 text-base tracking-widest outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <Button type="submit" disabled={pending} className="h-10 px-5">
                Turn on
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSetup(null)} className="h-10 px-4">
                Cancel
              </Button>
            </form>
          </div>
        ) : (
          <Button type="button" disabled={pending} onClick={begin} data-autostart={autoStart || undefined} className="h-10 px-5">
            {factors.length > 0 ? "Add another authenticator" : "Set up authenticator app"}
          </Button>
        )}
      </section>

      {factors.length > 0 || codes ? (
        <section aria-labelledby="recovery" className="space-y-3">
          <h3 id="recovery" className="flex items-center gap-2 font-semibold text-maroon-900">
            <KeyRound className="size-4.5 text-maroon-600" aria-hidden="true" />
            Recovery codes
          </h3>
          {codes ? (
            <div className="space-y-3 rounded-xl border border-maroon-200 bg-maroon-50/60 p-4">
              <p className="text-sm font-medium text-maroon-900">
                Save these now. They are shown only once. Each works one time if you lose your phone.
              </p>
              <ul className="grid gap-1.5 font-mono text-sm text-maroon-900 sm:grid-cols-2" aria-label="Recovery codes">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={download} className="h-9 px-3 text-sm">
                  <Download className="size-4" aria-hidden="true" />
                  Download
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCodes(null)} className="h-9 px-3 text-sm">
                  I saved them
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {recoveryRemaining === null
                  ? "You have no recovery codes. Without them, losing your phone means asking the Medyra team for help."
                  : `${recoveryRemaining} unused ${recoveryRemaining === 1 ? "code" : "codes"} left.`}
              </p>
              <Button type="button" variant="outline" disabled={pending} onClick={newCodes} className="h-9 px-3 text-sm">
                {recoveryRemaining === null ? "Create recovery codes" : "Replace recovery codes"}
              </Button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
