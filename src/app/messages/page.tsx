import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Lock, Search } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { controlClass, labelClass } from "@/components/forms/controls";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { cn } from "@/lib/utils";
import { PRIVACY_NOTE, SAFETY_NOTE } from "@/features/messaging/content";
import { ConversationList } from "@/features/messaging/components/conversation-list";
import { NewGroupForm, NewMessageForm } from "@/features/messaging/components/controls";
import { getPerson, listConnectionPeople, listConversations } from "@/features/messaging/queries";
import { parseInboxParams } from "@/features/messaging/schemas";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function MessagesPage({ searchParams }: Props) {
  return (
    <AppPage label="your messages">
      <MessagesContent searchParams={searchParams} />
    </AppPage>
  );
}

async function MessagesContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const params = parseInboxParams(await searchParams);

  const limited = await checkRateLimit("search", user.id);
  const [result, target, people] = await Promise.all([
    limited.ok ? listConversations(user.id, params) : Promise.resolve({ items: [], requestCount: 0, failed: false }),
    params.to && params.to !== user.id ? getPerson(params.to) : Promise.resolve(null),
    listConnectionPeople(user.id),
  ]);

  const tabHref = (tab: string) => (tab === "inbox" ? "/messages" : `/messages?tab=${tab}`);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Messages</h1>
          <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-maroon-600" aria-hidden="true" />
            <span>{PRIVACY_NOTE}</span>
          </p>
        </div>

        {target ? (
          <section aria-labelledby="new-message" className="space-y-3 rounded-2xl border border-maroon-200 bg-surface p-5">
            <h2 id="new-message" className="text-base font-semibold text-maroon-900">
              New message
            </h2>
            <NewMessageForm person={target} />
          </section>
        ) : null}

        <nav aria-label="Message lists" className="border-b border-border">
          <ul className="flex gap-1">
            {(
              [
                ["inbox", "Inbox"],
                ["requests", "Requests"],
              ] as const
            ).map(([tab, label]) => (
              <li key={tab}>
                <Link
                  href={tabHref(tab)}
                  aria-current={params.tab === tab ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    params.tab === tab ? "border-maroon-600 text-maroon-700" : "border-transparent text-muted-foreground hover:text-maroon-900",
                  )}
                >
                  {label}
                  {tab === "requests" && result.requestCount > 0 ? (
                    <span className="rounded-full bg-maroon-700 px-2 py-0.5 text-xs font-semibold text-white">{result.requestCount}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <form role="search" aria-label="Search conversations" action="/messages" method="get" className="flex flex-wrap items-end gap-2">
          {params.tab === "requests" ? <input type="hidden" name="tab" value="requests" /> : null}
          <div className="min-w-0 flex-1">
            <label htmlFor="conversation-q" className={labelClass}>
              Search conversations by name or message text
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="conversation-q" name="q" type="search" defaultValue={params.q} maxLength={60} className={`${controlClass} pl-9`} />
            </div>
          </div>
          <button type="submit" className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            Search
          </button>
        </form>

        {!limited.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {limited.message}
          </p>
        ) : result.failed ? (
          <p role="alert" className="text-sm text-destructive">
            Messages aren&apos;t loading right now. Please try again.
          </p>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={params.q ? "No conversations match" : params.tab === "requests" ? "No message requests" : "No conversations yet"}
            description={
              params.tab === "requests"
                ? "When someone you aren't connected with writes to you, it appears here and you choose whether to reply."
                : "Open a member's profile and choose Message, or start a group with your connections below."
            }
            action={{ href: "/network", label: "Find people" }}
          />
        ) : (
          <ConversationList items={result.items} />
        )}

        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-maroon-700">Start a group conversation</summary>
          <div className="mt-3">
            <NewGroupForm people={people} />
          </div>
        </details>
        <p className="text-xs leading-relaxed text-muted-foreground">{SAFETY_NOTE}</p>
      </main>
    </>
  );
}
