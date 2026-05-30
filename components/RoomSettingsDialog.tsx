"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Room, User } from "@/lib/db/schema";
import { deleteRoom, updateRoomSettings } from "@/lib/actions/rooms";
import { getAbsoluteAppUrl } from "@/lib/public-url";

export default function RoomSettingsDialog({
  room,
  user,
  open,
  onClose,
  emphasizeInvite = false,
}: {
  room: Room;
  user: User;
  open: boolean;
  onClose: () => void;
  emphasizeInvite?: boolean;
}) {
  const router = useRouter();
  const canEdit = user.isCreator;
  const invitePath = `/r/${room.code}`;
  const inviteUrl = getAbsoluteAppUrl(invitePath);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  if (!open) return null;

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  function openDeleteConfirm() {
    setDeleteError(null);
    setDeleteConfirmationName("");
    setDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (deletePending) return;
    setDeleteConfirmOpen(false);
    setDeleteError(null);
    setDeleteConfirmationName("");
  }

  function submit() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const trimmedName = String(formData.get("name") ?? "").trim();
    const parsedMaxMembers = Number(formData.get("maxMembers") ?? room.maxMembers);

    if (!trimmedName) {
      setError("Enter a room name.");
      return;
    }

    if (!Number.isInteger(parsedMaxMembers) || parsedMaxMembers < 2 || parsedMaxMembers > 50) {
      setError("Max members must be between 2 and 50.");
      return;
    }

    setError(null);

    formData.set("roomCode", room.code);
    formData.set("name", trimmedName);
    formData.set("maxMembers", String(parsedMaxMembers));

    startTransition(async () => {
      try {
        await updateRoomSettings(formData);
        setDeleteError(null);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update room.");
      }
    });
  }

  function submitDelete() {
    const confirmationName = deleteConfirmationName.trim();

    if (confirmationName !== room.name) {
      setDeleteError("Type the exact room name to confirm deletion.");
      return;
    }

    setDeleteError(null);
    setError(null);
    const formData = new FormData();
    formData.set("roomCode", room.code);
    formData.set("confirmationName", confirmationName);

    startDeleteTransition(async () => {
      try {
        await deleteRoom(formData);
        router.push("/");
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Failed to delete room.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-500">
              Room properties
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1E3A8A]">
              {room.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#dbe5f2] px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            Close
          </button>
        </div>

        {emphasizeInvite && (
          <div className="mt-4 rounded-[24px] border border-[#FED7AA] bg-[#FFF7ED] px-4 py-4 text-[#C2410C]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em]">
              Room created
            </p>
            <p className="mt-1 text-sm font-medium leading-6">
              Invite your friends with this link and let them join the room as
              themselves.
            </p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Room code
            </label>
            <input
              type="text"
              readOnly
              value={room.code}
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-[#1E3A8A] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Invite link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="min-w-0 flex-1 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="rounded-[20px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)]"
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy link"}
              </button>
            </div>
          </div>

          <form ref={formRef} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
                Room name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={room.name}
                readOnly={!canEdit}
                maxLength={60}
                className={
                  "w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 focus:border-[#3B82F6] focus:bg-white focus:outline-none " +
                  (canEdit ? "text-[#1E3A8A]" : "text-slate-600")
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
                Max members
              </label>
              <input
                type="number"
                name="maxMembers"
                min={2}
                max={50}
                defaultValue={room.maxMembers}
                readOnly={!canEdit}
                className={
                  "w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 focus:border-[#3B82F6] focus:bg-white focus:outline-none " +
                  (canEdit ? "text-[#1E3A8A]" : "text-slate-600")
                }
              />
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                2 to 50 members.
              </p>
            </div>
          </form>
        </div>

        {!canEdit && (
          <p className="mt-4 rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-600">
            Only the room creator can edit these settings.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {canEdit && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save room settings"}
            </button>

            <button
              type="button"
              onClick={openDeleteConfirm}
              className="mt-4 w-full rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 transition hover:bg-red-100"
            >
              Delete room
            </button>
          </>
        )}
      </div>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-[30px] border border-red-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-red-600">
                  Are you sure?
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#1E3A8A]">
                  Delete {room.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="rounded-2xl border border-[#dbe5f2] px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              This will permanently delete the room and all bets, wagers, and
              settlement history in it.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-bold text-red-700">
                Please type <span className="font-mono">{room.name}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmationName}
                onChange={(event) => {
                  setDeleteConfirmationName(event.target.value);
                  if (deleteError) setDeleteError(null);
                }}
                className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-red-900 focus:border-red-400 focus:outline-none"
              />
            </div>

            {deleteError && (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="flex-1 rounded-[24px] border border-[#dbe5f2] px-4 py-3 font-bold text-slate-600 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deletePending || deleteConfirmationName.trim() !== room.name
                }
                onClick={submitDelete}
                className="flex-1 rounded-[24px] bg-[linear-gradient(135deg,#DC2626_0%,#EF4444_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(220,38,38,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Yes, delete room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
