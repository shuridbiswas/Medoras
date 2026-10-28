"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProfileTab = {
  id: string;
  label: string;
  count?: number;
  panel: React.ReactNode;
};

/** WAI-ARIA tabs: roving tabindex, arrow keys, Home and End. All panels are server-rendered. */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const base = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(toIndex: number) {
    const next = tabs[(toIndex + tabs.length) % tabs.length];
    setActive(next.id);
    refs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        return move(index + 1);
      case "ArrowLeft":
        event.preventDefault();
        return move(index - 1);
      case "Home":
        event.preventDefault();
        return move(0);
      case "End":
        event.preventDefault();
        return move(tabs.length - 1);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Profile sections"
        className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              id={`${base}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "relative -mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                selected
                  ? "border-maroon-600 text-maroon-700"
                  : "border-transparent text-muted-foreground hover:text-maroon-900",
              )}
            >
              {tab.label}
              {tab.count ? (
                <span className="ml-1.5 rounded-full bg-maroon-50 px-1.5 py-0.5 text-xs text-maroon-700">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-6 focus-visible:rounded-lg"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
