"use client";

import { useState, useTransition } from "react";
import { proposeCustomBet } from "@/lib/actions/custom-bets";

export default function ProposeBetModal({
  roomCode,
  matchId,
}: {
  roomCode: string;
  matchId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setOption(idx: number, value: string) {
    setOptions((o) => o.map((v, i) => (i === idx ? value : v)));
  }
  function addOption() {
    if (options.length < 5) setOptions([...options, ""]);
  }
  function removeOption(idx: number) {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("title", title);
    fd.set("description", description);
    options.forEach((o) => fd.append("optionLabels", o));
    startTransition(async () => {
      try {
        await proposeCustomBet(fd);
        setOpen(false);
        setTitle("");
        setDescription("");
        setOptions(["Yes", "No"]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to propose bet.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        + Propose a custom bet
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Propose a custom bet</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          AI will generate odds when you submit. Takes a few seconds.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Will France score in the first half?"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Clarify the line if needed."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Options</label>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={50}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="rounded-lg border border-zinc-300 px-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 5 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                + Add option
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending || title.trim().length < 3 || options.some((o) => !o.trim())}
          onClick={submit}
          className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "AI is rating this…" : "Propose bet"}
        </button>
      </div>
    </div>
  );
}
