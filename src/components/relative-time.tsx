"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const absolute = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatRelative(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 7 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  }
  return absolute.format(new Date(then));
}

const subscribe = () => () => {};

/**
 * "2 days ago" in the viewer's own clock. The server render (and hydration) shows the plain
 * date instead, so the markup never disagrees with what the browser computes.
 */
export function RelativeTime({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso, Date.now()),
    () => (Number.isNaN(new Date(iso).getTime()) ? "" : absolute.format(new Date(iso))),
  );
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
