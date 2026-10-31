"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/forms/controls";
import { avatarUrl } from "@/lib/storage-url";
import { createClient } from "@/lib/supabase/client";
import { ReportButton } from "@/features/safety/components/report-button";
import { deleteMessage, markRead, sendMessage } from "@/features/messaging/actions";
import { MESSAGE_MAX } from "@/features/messaging/content";
import { personName, type ThreadMessage } from "@/features/messaging/types";
import { cn } from "@/lib/utils";

/**
 * Live updates come from Supabase Realtime (new rows in `messages`, filtered by row level
 * security). If Realtime is unavailable the thread checks for new messages every 15 seconds, so
 * messaging still works without it. The server owns the list: nothing is kept locally.
 */
function useLiveRefresh(conversationId: string) {
  const router = useRouter();
  useEffect(() => {
    let live = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
      channel = client
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          () => router.refresh(),
        )
        .subscribe((status) => {
          live = status === "SUBSCRIBED";
        });
    } catch {
      live = false;
    }
    const timer = setInterval(() => {
      if (!live && document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => {
      clearInterval(timer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [conversationId, router]);
}

export function Thread({
  conversationId,
  messages,
  canSend,
  lockedReason,
  group,
}: {
  conversationId: string;
  messages: ThreadMessage[];
  canSend: boolean;
  /** Why the composer is unavailable, shown in its place. */
  lockedReason?: string;
  group: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  useLiveRefresh(conversationId);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    if (lastId) void markRead(conversationId);
  }, [lastId, conversationId]);

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessage(conversationId, text);
      if (result.ok) {
        setText("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function remove(messageId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteMessage(messageId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol aria-label="Messages" className="flex-1 space-y-3 overflow-y-auto px-1 py-4">
        {messages.length === 0 ? <li className="text-center text-sm text-muted-foreground">No messages yet.</li> : null}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-2.5", m.mine && "flex-row-reverse")}>
            {!m.mine ? (
              <MemberAvatar name={m.sender?.first_name ?? "?"} src={avatarUrl(m.sender?.avatar_path ?? null)} className="size-8 text-xs" />
            ) : null}
            <div className={cn("max-w-[80%] min-w-0", m.mine && "text-right")}>
              <div
                className={cn(
                  "inline-block rounded-2xl px-3.5 py-2 text-left text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap",
                  m.mine ? "bg-maroon-700 text-white" : "bg-surface text-maroon-900 shadow-xs ring-1 ring-border",
                )}
              >
                {group && !m.mine ? (
                  <span className="mb-0.5 block text-xs font-semibold text-maroon-700">
                    {m.sender?.username ? <Link href={`/profile/${m.sender.username}`} className="hover:underline">{personName(m.sender)}</Link> : personName(m.sender)}
                  </span>
                ) : null}
                {m.body}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground" style={{ justifyContent: m.mine ? "flex-end" : "flex-start" }}>
                <RelativeTime iso={m.created_at} />
                {m.mine ? (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={pending}
                    aria-label="Delete this message"
                    className="inline-flex items-center gap-1 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                ) : (
                  <ReportButton targetType="message" targetId={m.id} label="Report" />
                )}
              </div>
            </div>
          </li>
        ))}
        <div ref={bottom} />
      </ol>

      {canSend ? (
        <form onSubmit={send} className="border-t border-border bg-sand/30 pt-3" noValidate>
          <label htmlFor={`${id}-text`} className="sr-only">
            Write a message
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={`${id}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
              }}
              rows={2}
              maxLength={MESSAGE_MAX}
              placeholder="Write a message"
              className={cn(textareaClass, "min-h-12 flex-1 py-2.5")}
            />
            <Button type="submit" disabled={pending || !text.trim()} className="h-11 px-4" aria-label="Send message">
              <Send className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{pending ? "Sending…" : "Send"}</span>
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">{lockedReason}</p>
      )}
    </div>
  );
}
