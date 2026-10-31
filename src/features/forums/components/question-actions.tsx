"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Bookmark, Trash2 } from "lucide-react";
import { ReportButton } from "@/features/safety/components/report-button";
import { deleteQuestion, setFollow, setSavedForum } from "@/features/forums/actions";
import { cn } from "@/lib/utils";

const button =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-maroon-50 hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

/** Follow, save, report or (for the writer) delete a question. */
export function QuestionActions({
  questionId,
  following: initialFollowing,
  saved: initialSaved,
  isMine,
}: {
  questionId: string;
  following: boolean;
  saved: boolean;
  isMine: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [saved, setSaved] = useState(initialSaved);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleFollow() {
    setError(null);
    startTransition(async () => {
      const result = await setFollow(questionId, !following);
      if (result.ok) setFollowing(result.on);
      else setError(result.error);
    });
  }
  function toggleSaved() {
    setError(null);
    startTransition(async () => {
      const result = await setSavedForum("forum_question", questionId, !saved);
      if (result.ok) setSaved(result.saved);
      else setError(result.error);
    });
  }
  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuestion(questionId);
      if (result.ok) router.push("/forums");
      else {
        setError(result.error);
        setConfirm(false);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={toggleFollow} disabled={pending} aria-pressed={following} className={cn(button, following && "text-maroon-700")}>
          {following ? <BellOff className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
          {following ? "Following" : "Follow"}
        </button>
        <button type="button" onClick={toggleSaved} disabled={pending} aria-pressed={saved} className={cn(button, saved && "text-maroon-700")}>
          <Bookmark className={cn("size-4", saved && "fill-maroon-700")} aria-hidden="true" />
          {saved ? "Saved" : "Save"}
        </button>
        {isMine ? (
          confirm ? (
            <>
              <span className="text-sm text-muted-foreground">Delete this question and its answers?</span>
              <button type="button" onClick={remove} disabled={pending} className={cn(button, "text-destructive hover:text-destructive")}>
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={button}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className={button}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </button>
          )
        ) : (
          <ReportButton targetType="question" targetId={questionId} />
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
