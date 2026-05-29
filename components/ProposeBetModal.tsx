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
        className="w-full rounded-[24px] border-2 border-dashed border-[#cfdced] bg-[#F8FBFF] px-4 py-3 text-sm font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-white"
      >
        + Propose a custom bet
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-black text-[#1E3A8A]">
            Propose a custom bet
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-500 transition hover:text-[#1E3A8A]"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          AI will generate odds when you submit. Takes a few seconds.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Will France score in the first half?"
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Clarify the line if needed."
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Options
            </label>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={50}
                    className="flex-1 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="rounded-2xl border border-[#cdd9ea] px-3 text-slate-500 transition hover:border-[#3B82F6] hover:bg-white"
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
                className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-[#1E3A8A]"
              >
                + Add option
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending || title.trim().length < 3 || options.some((o) => !o.trim())}
          onClick={submit}
          className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "AI is rating this…" : "Propose bet"}
        </button>
      </div>
    </div>
  );
}
