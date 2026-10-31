import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { PENDING_NOTE, PRIVACY_NOTE, REQUEST_NOTE, SAFETY_NOTE } from "@/features/messaging/content";
import { ConversationList } from "@/features/messaging/components/conversation-list";
import { RequestBanner, ThreadControls } from "@/features/messaging/components/controls";
import { Thread } from "@/features/messaging/components/thread";
import { getThread, listConnectionPeople, listConversations } from "@/features/messaging/queries";
import { idSchema } from "@/features/messaging/schemas";
import { personName } from "@/features/messaging/types";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false },
};

type Props = { params: Promise<{ conversationId: string }> };

export default function ConversationPage({ params }: Props) {
  return (
    <AppPage label="the conversation">
      <ConversationContent params={params} />
    </AppPage>
  );
}

async function ConversationContent({ params }: Props) {
  const { conversationId } = await params;
  const { user, profile } = await requireMember();
  // A malformed id, a missing conversation and one the viewer is not part of all look the same.
  if (!idSchema.safeParse(conversationId).success) notFound();
  const thread = await getThread(user.id, conversationId);
  if (!thread) notFound();

  const [inbox, people] = await Promise.all([
    listConversations(user.id, { tab: "inbox", q: "" }),
    thread.kind === "group" && thread.isAdmin ? listConnectionPeople(user.id) : Promise.resolve([]),
  ]);
  const inGroup = new Set(thread.others.map((o) => o.id));
  const title = thread.kind === "group" ? (thread.title ?? "Group") : personName(thread.others[0]);
  const first = thread.others[0];
  const pending = thread.status === "pending";

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[19rem_1fr]">
        <aside aria-label="Your conversations" className="hidden lg:block">
          {inbox.items.length > 0 ? <ConversationList items={inbox.items} activeId={thread.id} /> : null}
        </aside>

        <section aria-labelledby="thread-title" className="flex min-w-0 flex-col">
          <Link href={pending ? "/messages?tab=requests" : "/messages"} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline lg:hidden">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Messages
          </Link>
          <header className="space-y-1 border-b border-border pb-3">
            <h1 id="thread-title" className="text-xl font-bold text-maroon-900">
              {thread.kind === "direct" && first?.username ? (
                <Link href={`/profile/${first.username}`} className="hover:underline">
                  {title}
                </Link>
              ) : (
                title
              )}
            </h1>
            {thread.kind === "group" ? (
              <p className="text-sm text-muted-foreground">
                With{" "}
                {thread.others.map((o, i) => (
                  <span key={o.id}>
                    {i > 0 ? ", " : ""}
                    {o.username ? (
                      <Link href={`/profile/${o.username}`} className="hover:underline">
                        {personName(o)}
                      </Link>
                    ) : (
                      personName(o)
                    )}
                  </span>
                ))}
              </p>
            ) : first?.headline ? (
              <p className="text-sm text-muted-foreground">{first.headline}</p>
            ) : null}
          </header>

          {pending ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-maroon-200 bg-maroon-50/70 p-4">
              <p className="text-sm text-maroon-900">{REQUEST_NOTE}</p>
              <RequestBanner conversationId={thread.id} />
            </div>
          ) : thread.awaitingReply ? (
            <p className="mt-3 rounded-xl bg-sand/70 p-3 text-sm text-maroon-900">{PENDING_NOTE}</p>
          ) : null}

          <div className="flex h-[62dvh] min-h-80 flex-col">
            <Thread
              conversationId={thread.id}
              messages={thread.messages}
              group={thread.kind === "group"}
              canSend={!pending}
              lockedReason="Accept the request above to reply."
            />
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <ThreadControls
              conversationId={thread.id}
              isGroup={thread.kind === "group"}
              isAdmin={thread.isAdmin}
              candidates={people.filter((p) => !inGroup.has(p.id))}
            />
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-maroon-600" aria-hidden="true" />
              <span>
                {PRIVACY_NOTE} {SAFETY_NOTE} Use Report beside any message you receive. To stop someone contacting you, block them from their profile.
              </span>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
