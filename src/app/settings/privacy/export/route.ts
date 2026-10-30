import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRecentAuth, requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { exportMemberData } from "@/features/privacy/export";

/**
 * "Download my data". POST only (so a link, prefetch or image tag can never trigger it), for the
 * signed-in member only, and only after a recent sign-in. The file is never cached.
 */
export async function POST() {
  const { user } = await requireMember();
  if (!isRecentAuth(user)) redirect(`/reauth?next=${encodeURIComponent("/settings/privacy")}`);

  const limited = await checkRateLimit("privacy", user.id);
  if (!limited.ok) {
    return NextResponse.json({ error: limited.message }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();
  const data = await exportMemberData(user, supabase);
  const recorded = await supabase.rpc("record_data_export");
  if (recorded.error) reportError("record_data_export", recorded.error);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="medyra-data-${stamp}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Anything else is not allowed (and nothing is revealed about the route).
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
