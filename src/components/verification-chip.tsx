/**
 * Credentials are not verified anywhere in Medyra yet, so members are shown as "Unverified".
 * When a real verification process exists this is the one place to show a verified state.
 */
export function VerificationChip() {
  return (
    <span
      title="Medyra does not verify credentials yet"
      className="inline-flex items-center rounded-full border border-border bg-sand px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
    >
      Unverified
    </span>
  );
}
