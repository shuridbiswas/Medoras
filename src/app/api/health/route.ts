import { NextResponse } from "next/server";
import { connection } from "next/server";
import { serviceStatus } from "@/lib/services";

/**
 * Deployment smoke test: confirms the app is running and which optional services have
 * configuration. Reports presence only (true/false), never any value.
 */
export async function GET() {
  await connection(); // read the environment at request time, not at build time
  return NextResponse.json(
    {
      status: "ok",
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.CONTEXT ?? "unknown",
      services: serviceStatus(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
