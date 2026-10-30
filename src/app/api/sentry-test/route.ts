import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";

/**
 * Deliberately throws so you can confirm errors reach Sentry (see TESTING.md).
 * Disabled (404) unless SENTRY_TEST_TOKEN is set on the server AND the request sends the same
 * value in the x-sentry-test-token header, so it can't be used to spam your Sentry project.
 */
export async function GET(request: NextRequest) {
  await connection();
  const expected = process.env.SENTRY_TEST_TOKEN;
  const given = request.headers.get("x-sentry-test-token") ?? "";
  const ok =
    Boolean(expected) &&
    given.length === expected!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected!));
  if (!ok) return new NextResponse(null, { status: 404 });

  throw new Error("Medyra Sentry test: deliberate server exception");
}
