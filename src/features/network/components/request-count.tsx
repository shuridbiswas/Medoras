import { countIncomingRequests } from "@/features/network/queries";

/** Small badge for pending connection requests waiting on the viewer. Renders nothing for zero. */
export async function RequestCountBadge({ userId }: { userId: string }) {
  let count = 0;
  try {
    count = await countIncomingRequests(userId);
  } catch {
    count = 0;
  }
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-maroon-700 px-2 py-0.5 text-[0.65rem] font-bold text-white">
      <span aria-hidden="true">{count > 9 ? "9+" : count}</span>
      <span className="sr-only">{count} pending requests</span>
    </span>
  );
}
