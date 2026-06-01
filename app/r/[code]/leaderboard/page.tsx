import { getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import { getRoomUsers } from "@/lib/db/queries";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import Leaderboard from "@/components/Leaderboard";

export default async function LeaderboardPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);

  const [members, tnav] = await Promise.all([
    getRoomUsers(room.id),
    getTranslations("nav"),
  ]);

  return (
    <>
      <RoomHeader room={room} user={user} />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-6">
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={tnav("leaderboard")}
        />
        <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {room.code}
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#1E3A8A]">
            {room.name}
          </h1>
        </section>
        <Leaderboard users={members} meId={user.id} roomCode={room.code} />
      </main>
    </>
  );
}
