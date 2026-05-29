import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, users } from "@/lib/db/schema";
import { selectIdentity } from "@/lib/actions/rooms";
import { getUserIdForRoom } from "@/lib/identity";
import { normalizeRoomCode } from "@/lib/code";
import AppHeader from "@/components/AppHeader";

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
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <header className="mb-8 text-center">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-slate-500">
              Room
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#1E3A8A]">
              {room.name}
            </h1>
            <p className="mt-3 text-slate-600">
              Choose your seat at the table.
            </p>
          </header>

          <ul className="space-y-3">
            {roomUsers.map((u) => (
              <li key={u.id}>
                <form action={selectIdentity}>
                  <input type="hidden" name="roomCode" value={code} />
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#3B82F6] hover:bg-white"
                  >
                    <span>
                      <span className="text-lg font-bold text-[#1E3A8A]">
                        {u.name}
                      </span>
                      {u.isCreator && (
                        <span className="ml-2 rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#EA580C]">
                          creator
                        </span>
                      )}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-mono text-sm font-bold text-slate-500 ring-1 ring-[#dbe5f2]">
                      {u.chips} chips
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
