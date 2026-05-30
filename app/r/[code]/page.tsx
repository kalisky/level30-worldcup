import { and, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rooms, users } from "@/lib/db/schema";
import { joinRoom } from "@/lib/actions/rooms";
import { getAuthenticatedUser, profileRedirectPath } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";
import AppHeader from "@/components/AppHeader";
import GoogleLoginButton from "@/components/GoogleLoginButton";

export default async function JoinRoomPage(props: {
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

  const [occupancy] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.roomId, room.id));

  const memberCount = occupancy?.count ?? 0;
  const authUser = await getAuthenticatedUser();

  if (authUser?.displayName) {
    const [membership] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
      .limit(1);

    if (membership) {
      redirect(`/r/${code}/dashboard`);
    }
  } else if (authUser) {
    redirect(profileRedirectPath(`/r/${code}`));
  }

  const isFull = memberCount >= room.maxMembers;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <header className="mb-8 text-center">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-slate-500">
              Invitation
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#1E3A8A]">
              {room.name}
            </h1>
            <p className="mt-3 text-slate-600">
              Room code <span className="font-mono font-bold">{room.code}</span> ·{" "}
              {memberCount}/{room.maxMembers} members
            </p>
          </header>

          {!authUser ? (
            <>
              <p className="mb-5 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4 text-sm leading-7 text-slate-600">
                Sign in with Google first, then you can join this room as
                yourself.
              </p>
              <GoogleLoginButton redirectTo={`/r/${code}`} />
            </>
          ) : isFull ? (
            <p className="rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4 text-center text-sm font-medium text-slate-600">
              This room is already full.
            </p>
          ) : (
            <>
              <div className="mb-5 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Joining as
                </p>
                <p className="mt-1 text-lg font-black text-[#1E3A8A]">
                  {authUser.displayName}
                </p>
              </div>
              <form action={joinRoom}>
                <input type="hidden" name="roomCode" value={code} />
                <button
                  type="submit"
                  className="w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5"
                >
                  Join room
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
