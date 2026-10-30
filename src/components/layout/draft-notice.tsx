import { TriangleAlert } from "lucide-react";
import { POLICY_VERSION } from "@/lib/legal";

/**
 * Shown at the top of the Terms, Privacy Policy and Community Guidelines until a qualified
 * lawyer has reviewed them. Remove it (and the "-draft" in POLICY_VERSION) only after that.
 */
export function DraftNotice() {
  return (
    <div
      role="note"
      className="not-prose flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-base leading-relaxed text-amber-950"
    >
      <TriangleAlert className="mt-1 size-5 shrink-0" aria-hidden="true" />
      <p>
        <strong>Draft for legal review (version {POLICY_VERSION}).</strong> This document describes how Medyra works
        today, but it has <strong>not</strong> been reviewed by a lawyer and is <strong>not legal advice</strong>. It
        does not on its own make Medyra compliant with any law, including Québec&apos;s Law 25 or other Canadian
        privacy and consumer-protection rules. It must be reviewed and approved by a qualified professional before
        Medyra opens to the public.
      </p>
    </div>
  );
}
