import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import CreateRoomForm from "@/components/CreateRoomForm";
import { requireProfiledUser } from "@/lib/auth";

export default async function NewRoomPage() {
  const authUser = await requireProfiledUser("/room/new");

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-2xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-500 transition hover:text-[#1E3A8A]"
            >
              ← Back
            </Link>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-[#1E3A8A]">
            Create a room
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Set up a private room, share the code, and let your friends join as
            themselves with Google login.
          </p>
          <CreateRoomForm creatorName={authUser.displayName!} />
        </div>
      </main>
    </>
  );
}
