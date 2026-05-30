import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";
import CreateRoomLauncher from "@/components/CreateRoomLauncher";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import SubmitButton from "@/components/SubmitButton";
import { joinRoomByCode } from "@/lib/actions/rooms";
import { getAuthenticatedUser, profileRedirectPath } from "@/lib/auth";

export default async function Home(props: {
  searchParams: Promise<{ next?: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const nextPath = Array.isArray(searchParams.next)
    ? searchParams.next[0]
    : searchParams.next;
  const authUser = await getAuthenticatedUser();

  if (authUser && !authUser.displayName) {
    redirect(profileRedirectPath(nextPath || "/"));
  }

  const isSignedIn = !!authUser;
  const t = await getTranslations("landing");

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
            <div className="inline-flex rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#1D4ED8]">
              {t("title")}
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-tight text-[#1E3A8A]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              {t("tagline")}
            </p>
          </section>

          <section className="rounded-[32px] border border-[#dbe5f2] bg-white p-6 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
            {isSignedIn ? (
              <>
                <CreateRoomLauncher
                  creatorName={authUser.displayName!}
                  variant="hero"
                />

                <div className="relative my-6 flex items-center">
                  <div className="flex-grow border-t border-[#dbe5f2]" />
                  <span className="mx-3 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-slate-500">
                    {t("or")}
                  </span>
                  <div className="flex-grow border-t border-[#dbe5f2]" />
                </div>

                <form
                  action={joinRoomByCode}
                  className="space-y-3 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] p-5"
                >
                  <label
                    htmlFor="code"
                    className="block text-sm font-bold text-[#1E3A8A]"
                  >
                    {t("joinRoom")}
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    placeholder="ABCDE"
                    autoCapitalize="characters"
                    autoComplete="off"
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-[#cdd9ea] bg-white px-4 py-3 text-lg font-semibold tracking-[0.35em] uppercase text-[#1E3A8A] placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:border-[#3B82F6] focus:outline-none"
                  />
                  <SubmitButton
                    pendingLabel={t("joinRoomPending")}
                    className="w-full rounded-2xl border border-[#cdd9ea] bg-white px-4 py-3 font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:cursor-progress"
                  >
                    {t("joinRoomCta")}
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <div className="mt-6">
                  <GoogleLoginButton redirectTo={nextPath || "/"} />
                </div>
              </>
            )}

            <footer className="mt-6 text-center text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              {t("kickoff")}
            </footer>
          </section>
        </div>
      </main>
    </>
  );
}
