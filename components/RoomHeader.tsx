import Link from "next/link";
import type { Room, User } from "@/lib/db/schema";

export default function RoomHeader({
  room,
  user,
  active = "dashboard",
}: {
  room: Room;
  user: User;
  active?: "dashboard" | "admin";
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/r/${room.code}/dashboard`}
            className="text-base font-semibold tracking-tight"
          >
            {room.name}
          </Link>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {room.code}
          </span>
        </div>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={`/r/${room.code}/dashboard`}
            className={
              "rounded-md px-2.5 py-1 " +
              (active === "dashboard"
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
            }
          >
            Dashboard
          </Link>
          <Link
            href={`/r/${room.code}/admin`}
            className={
              "rounded-md px-2.5 py-1 " +
              (active === "admin"
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
            }
          >
            Settle
          </Link>
          <span className="ml-2 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            {user.name} · {user.chips}
          </span>
        </nav>
      </div>
    </header>
  );
}
