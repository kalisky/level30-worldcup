import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import { saveDisplayName } from "@/lib/actions/profile";
import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function WelcomePage(props: {
  searchParams: Promise<{ next?: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const nextPath = Array.isArray(searchParams.next)
    ? searchParams.next[0]
    : searchParams.next;
  const authUser = await getAuthenticatedUser();

  if (!authUser) {
    redirect(nextPath ? `/?next=${encodeURIComponent(nextPath)}` : "/");
  }

  if (authUser.displayName) {
    redirect(nextPath || "/");
  }

  const t = await getTranslations("welcome");

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <header className="mb-8 text-center">
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#1E3A8A]">
              {t("title")}
            </h1>
            <p className="mt-3 text-slate-600">
              {t("subtitle")}
            </p>
          </header>

          <form action={saveDisplayName} className="space-y-5">
            <input type="hidden" name="next" value={nextPath ?? "/"} />
            <div>
              <label
                htmlFor="displayName"
                className="mb-2 block text-sm font-bold text-[#1E3A8A]"
              >
                {t("displayName")}
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                dir="auto"
                defaultValue={authUser.googleName ?? ""}
                maxLength={40}
                required
                className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
              />
            </div>

            <SubmitButton
              pendingLabel={t("savePending")}
              className="w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5 disabled:cursor-progress disabled:hover:translate-y-0"
            >
              {t("save")}
            </SubmitButton>
          </form>
        </div>
      </main>
    </>
  );
}
