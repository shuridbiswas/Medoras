"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function phrase(hour: number) {
  if (hour < 5) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Time-of-day greeting from the viewer's own clock. The server render says "Welcome back",
 * because the server doesn't know the member's time zone.
 */
export function Greeting({ firstName }: { firstName: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => phrase(new Date().getHours()),
    () => "Welcome back",
  );
  return (
    <h1 className="text-2xl font-bold text-maroon-900 sm:text-[1.7rem]">
      {text}, {firstName}
    </h1>
  );
}
