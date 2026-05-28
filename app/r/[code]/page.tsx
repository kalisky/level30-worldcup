import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, users } from "@/lib/db/schema";
import { selectIdentity } from "@/lib/actions/rooms";
import { getUserIdForRoom } from "@/lib/identity";
import { normalizeRoomCode } from "@/lib/code";

export default async function PickIdentityPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await props.params;
  const code = normalizeRoomCode(rawCode);

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) notFound();

  const existingUserId = await getUserIdForRoom(code);
  if (existingUserId) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, existingUserId))
      .limit(1);
    if (u) redirect(`/r/${code}/dashboard`);
  }

  const roomUsers = await db
    .select()
    .from(users)
    .where(eq(users.roomId, room.id));

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-sm uppercase tracking-wider text-zinc-500">
            Room
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {room.name}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Tap your name to enter.
          </p>
        </header>

        <ul className="space-y-2">
          {roomUsers.map((u) => (
            <li key={u.id}>
              <form action={selectIdentity}>
                <input type="hidden" name="roomCode" value={code} />
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left text-lg font-medium transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <span>
                    {u.name}
                    {u.isCreator && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal dark:bg-zinc-700">
                        creator
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-normal text-zinc-500">
                    {u.chips} chips
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
