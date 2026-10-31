"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, MessageCircle, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/forms/controls";
import { ReportButton } from "@/features/safety/components/report-button";
import {
  acceptAnswer,
  deleteAnswer,
  deleteReply,
  postAnswer,
  postReply,
  setHelpful,
  setSavedForum,
} from "@/features/forums/actions";
import { ANONYMITY } from "@/features/forums/content";
import { ANSWER_MAX, REPLY_MAX } from "@/features/forums/options";
import { AnonymityExplainer } from "@/features/forums/components/forum-notices";
import { AuthorLine } from "@/features/forums/components/author-line";
import type { AnswerEntry, ReplyEntry } from "@/features/forums/types";
import { cn } from "@/lib/utils";

const button =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-maroon-50 hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

type Outcome = { ok: true } | { ok: false; error: string };

/** Runs a server action, refreshes the page's server data on success, and keeps the error in view. */
function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<Outcome>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }
  const line = error ? (
    <p role="alert" className="mt-1.5 text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;
  return { run, pending, line };
}

function Composer({
  label,
  max,
  rows,
  submitLabel,
  pendingLabel,
  onSubmit,
  onDone,
  explainAnonymity,
}: {
  label: string;
  max: number;
  rows: number;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (body: string, anonymous: boolean) => Promise<Outcome>;
  onDone?: () => void;
  explainAnonymity?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const { run, pending, line } = useAction();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => onSubmit(text, anonymous),
          () => {
            setText("");
            onDone?.();
          },
        );
      }}
      className="space-y-2.5"
      noValidate
    >
      <label htmlFor={`${id}-text`} className="sr-only">
        {label}
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        maxLength={max}
        placeholder={label}
        className={textareaClass}
      />
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 accent-maroon-700" />
        <span>
          <span className="font-medium text-maroon-900">{ANONYMITY.label}</span>
          <span className="block text-xs text-muted-foreground">{ANONYMITY.summary}</span>
        </span>
      </label>
      {explainAnonymity ? <AnonymityExplainer /> : null}
      {line}
      <Button type="submit" disabled={pending || !text.trim()} className="h-10 px-5">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function Reply({ reply }: { reply: ReplyEntry }) {
  const { run, pending, line } = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="rounded-xl bg-sand/60 p-3">
      <AuthorLine author={reply.author} anonymous={reply.is_anonymous} createdAt={reply.created_at} size="sm" />
      <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-maroon-900/90">{reply.body}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {reply.isMine ? (
          confirm ? (
            <>
              <span className="text-xs text-muted-foreground">Delete this reply?</span>
              <button type="button" disabled={pending} onClick={() => run(() => deleteReply(reply.id))} className="text-xs font-medium text-destructive">
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-xs text-muted-foreground">
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" aria-hidden="true" /> Delete
            </button>
          )
        ) : (
          <ReportButton targetType="reply" targetId={reply.id} />
        )}
      </div>
      {line}
    </li>
  );
}

function Answer({ answer, questionId, canAccept }: { answer: AnswerEntry; questionId: string; canAccept: boolean }) {
  const id = useId();
  const [voted, setVoted] = useState(answer.votedByMe);
  const [helpful, setHelpfulCount] = useState(answer.helpfulCount);
  const [saved, setSaved] = useState(answer.savedByMe);
  const [replying, setReplying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { run, pending, line } = useAction();

  function toggleHelpful() {
    const next = !voted;
    run(
      async () => {
        const result = await setHelpful(answer.id, next);
        if (result.ok) {
          setVoted(result.on);
          setHelpfulCount((n) => Math.max(0, n + (result.on ? 1 : -1)));
        }
        return result;
      },
    );
  }
  function toggleSaved() {
    run(async () => {
      const result = await setSavedForum("forum_answer", answer.id, !saved);
      if (result.ok) setSaved(result.saved);
      return result;
    });
  }

  return (
    <li id={`answer-${answer.id}`} className={cn("scroll-mt-24 rounded-2xl border bg-surface p-4 shadow-xs sm:p-5", answer.accepted ? "border-maroon-400" : "border-border")}>
      {answer.accepted ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-maroon-700 px-3 py-1 text-xs font-semibold text-white">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Accepted by the person who asked
        </p>
      ) : null}
      <AuthorLine author={answer.author} anonymous={answer.is_anonymous} createdAt={answer.created_at} edited={Boolean(answer.edited_at)} />
      <p className="mt-3 text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap text-maroon-900/90">{answer.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
        <button
          type="button"
          onClick={toggleHelpful}
          disabled={pending || answer.isMine}
          aria-pressed={voted}
          aria-label={`${voted ? "Remove helpful mark" : "Mark helpful"}. ${helpful} ${helpful === 1 ? "member finds" : "members find"} this helpful`}
          title={answer.isMine ? "You can't mark your own answer helpful" : undefined}
          className={cn(button, voted && "text-maroon-700")}
        >
          <ThumbsUp className={cn("size-4", voted && "fill-maroon-700")} aria-hidden="true" />
          Helpful <span aria-hidden="true">{helpful}</span>
        </button>
        <button type="button" onClick={() => setReplying((v) => !v)} aria-expanded={replying} aria-controls={`${id}-reply`} className={button}>
          <MessageCircle className="size-4" aria-hidden="true" />
          Reply {answer.replies.length > 0 ? `(${answer.replies.length})` : ""}
        </button>
        {canAccept ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptAnswer(questionId, answer.accepted ? null : answer.id))}
            className={cn(button, answer.accepted && "text-maroon-700")}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {answer.accepted ? "Remove acceptance" : "Accept answer"}
          </button>
        ) : null}
        <button type="button" onClick={toggleSaved} disabled={pending} aria-pressed={saved} aria-label={saved ? "Remove answer from saved" : "Save this answer"} className={cn(button, "ml-auto", saved && "text-maroon-700")}>
          <Bookmark className={cn("size-4", saved && "fill-maroon-700")} aria-hidden="true" />
        </button>
        {answer.isMine ? (
          confirm ? (
            <>
              <span className="text-sm text-muted-foreground">Delete this answer?</span>
              <button type="button" disabled={pending} onClick={() => run(() => deleteAnswer(answer.id))} className={cn(button, "text-destructive hover:text-destructive")}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={button}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className={button} aria-label="Delete your answer">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )
        ) : (
          <ReportButton targetType="answer" targetId={answer.id} />
        )}
      </div>
      {line}

      {answer.replies.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Replies">
          {answer.replies.map((r) => (
            <Reply key={r.id} reply={r} />
          ))}
        </ul>
      ) : null}

      <div id={`${id}-reply`}>
        {replying ? (
          <div className="mt-3">
            <Composer
              label="Write a reply"
              max={REPLY_MAX}
              rows={2}
              submitLabel="Reply"
              pendingLabel="Replying…"
              onSubmit={(body, anonymous) => postReply(answer.id, body, anonymous)}
              onDone={() => setReplying(false)}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AnswerSection({ questionId, answers, canAccept }: { questionId: string; answers: AnswerEntry[]; canAccept: boolean }) {
  return (
    <section aria-labelledby="answers-heading" className="space-y-4">
      <h2 id="answers-heading" className="text-lg font-semibold text-maroon-900">
        {answers.length} {answers.length === 1 ? "answer" : "answers"}
      </h2>
      {answers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-maroon-200 bg-maroon-50/50 p-4 text-sm text-muted-foreground">
          No answers yet. If you can help with what is being asked, share what you know and say how sure you are.
        </p>
      ) : (
        <ul className="space-y-4">
          {answers.map((a) => (
            <Answer key={a.id} answer={a} questionId={questionId} canAccept={canAccept} />
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="mb-3 text-base font-semibold text-maroon-900">Your answer</h3>
        <Composer
          label="Share what you know. Cite sources where you can, and say when you're unsure."
          max={ANSWER_MAX}
          rows={5}
          submitLabel="Post answer"
          pendingLabel="Posting…"
          onSubmit={(body, anonymous) => postAnswer(questionId, body, anonymous)}
          explainAnonymity
        />
      </div>
    </section>
  );
}
