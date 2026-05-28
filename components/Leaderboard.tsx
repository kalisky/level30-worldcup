import type { User } from "@/lib/db/schema";

export default function Leaderboard({
  users,
  meId,
}: {
  users: User[];
  meId: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Leaderboard
      </h2>
      <ol className="space-y-1.5">
        {users.map((u, i) => (
          <li
            key={u.id}
            className={
              "flex items-center justify-between rounded-lg px-3 py-2 " +
              (u.id === meId
                ? "bg-amber-50 dark:bg-amber-900/20"
                : "bg-zinc-50 dark:bg-zinc-800/50")
            }
          >
            <span className="flex items-center gap-2.5">
              <span className="w-5 text-right font-mono text-sm text-zinc-500">
                {i + 1}.
              </span>
              <span className="font-medium">{u.name}</span>
              {u.id === meId && (
                <span className="text-xs text-zinc-500">(you)</span>
              )}
            </span>
            <span className="font-mono text-sm">{u.chips}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
