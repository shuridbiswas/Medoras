"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarUrl } from "@/lib/storage-url";
import {
  addGroupMember,
  createGroup,
  leaveConversation,
  respondToRequest,
  startConversation,
} from "@/features/messaging/actions";
import { MESSAGE_MAX } from "@/features/messaging/content";
import { personName, type Person } from "@/features/messaging/types";

type Outcome = { ok: true } | { ok: false; error: string };

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Outcome>, after: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after();
      else setError(result.error);
    });
  };
  const line = error ? (
    <p role="alert" className="mt-2 text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;
  return { run, pending, line };
}

/** Accept or decline a message request. Declining is private. */
export function RequestBanner({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { run, pending, line } = useRun();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => run(() => respondToRequest(conversationId, true), () => router.refresh())} className="h-10 px-5">
          Accept
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => respondToRequest(conversationId, false), () => router.push("/messages?tab=requests"))} className="h-10 px-5">
          Decline
        </Button>
      </div>
      {line}
    </div>
  );
}

/** Leave a conversation, and (for a group admin) add one of your connections. */
export function ThreadControls({
  conversationId,
  isGroup,
  isAdmin,
  candidates,
}: {
  conversationId: string;
  isGroup: boolean;
  isAdmin: boolean;
  candidates: Person[];
}) {
  const id = useId();
  const router = useRouter();
  const { run, pending, line } = useRun();
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState("");

  return (
    <div className="space-y-3 text-sm">
      {isGroup && isAdmin && candidates.length > 0 ? (
        <div>
          <label htmlFor={`${id}-add`} className={labelClass}>
            Add one of your connections
          </label>
          <div className="flex gap-2">
            <select id={`${id}-add`} value={adding} onChange={(e) => setAdding(e.target.value)} className={controlClass}>
              <option value="">Choose a person</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {personName(p)}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" disabled={pending || !adding} onClick={() => run(() => addGroupMember(conversationId, adding), () => { setAdding(""); router.refresh(); })} className="h-10 px-4">
              Add
            </Button>
          </div>
        </div>
      ) : null}
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Leave this conversation? You won&apos;t see it again.</span>
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => leaveConversation(conversationId), () => router.push("/messages"))} className="h-9 px-4">
            Yes, leave
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirm(false)} className="h-9 px-3">
            Stay
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setConfirm(true)} className="h-9 px-3 text-muted-foreground">
          Leave conversation
        </Button>
      )}
      {line}
    </div>
  );
}

/** Start a one-to-one conversation (or message request) with a member. */
export function NewMessageForm({ person }: { person: Person }) {
  const id = useId();
  const router = useRouter();
  const [text, setText] = useState("");
  const { run, pending, line } = useRun();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          async () => {
            const result = await startConversation(person.id, text);
            if (result.ok) router.push(`/messages/${result.conversationId}`);
            return result;
          },
          () => undefined,
        );
      }}
      className="space-y-3"
      noValidate
    >
      <div className="flex items-center gap-3">
        <MemberAvatar name={person.first_name} src={avatarUrl(person.avatar_path)} className="size-11" />
        <p className="font-semibold text-maroon-900">{personName(person)}</p>
      </div>
      <label htmlFor={`${id}-body`} className={labelClass}>
        Your message
      </label>
      <textarea id={`${id}-body`} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={MESSAGE_MAX} className={textareaClass} />
      <p className="text-xs text-muted-foreground">
        If you aren&apos;t connected, this is sent as a message request and they choose whether to reply.
      </p>
      {line}
      <Button type="submit" disabled={pending || !text.trim()} className="h-10 px-5">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

/** Make a group from your connections. */
export function NewGroupForm({ people }: { people: Person[] }) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const { run, pending, line } = useRun();
  const toggle = (pid: string) => setChosen((c) => (c.includes(pid) ? c.filter((x) => x !== pid) : [...c, pid]));

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Groups are made from your connections. Connect with people in the Network first.</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          async () => {
            const result = await createGroup(title, chosen);
            if (result.ok) router.push(`/messages/${result.conversationId}`);
            return result;
          },
          () => undefined,
        );
      }}
      className="space-y-3"
      noValidate
    >
      <div>
        <label htmlFor={`${id}-title`} className={labelClass}>
          Group name
        </label>
        <input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={controlClass} />
      </div>
      <fieldset>
        <legend className={labelClass}>Add people ({chosen.length} chosen, up to 19)</legend>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-2">
          {people.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-maroon-50">
                <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} className="accent-maroon-700" />
                {personName(p)}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {line}
      <Button type="submit" disabled={pending || !title.trim() || chosen.length === 0} className="h-10 px-5">
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
