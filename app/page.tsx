import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";
import CreateRoomLauncher from "@/components/CreateRoomLauncher";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import PublicSiteFooter from "@/components/PublicSiteFooter";
import SubmitButton from "@/components/SubmitButton";
import { joinRoomByCode } from "@/lib/actions/rooms";
import {
  getAuthenticatedUser,
  getDefaultRoomDashboardPath,
  profileRedirectPath,
} from "@/lib/auth";

function LandingHeroIllustration({ rtl = false }: { rtl?: boolean }) {
  const cardMirrorTransform = rtl ? "translate(400 0) scale(-1 1)" : undefined;
  const homeTeamX = rtl ? 290 : 80;
  const awayTeamX = rtl ? 190 : 180;
  const vsX = rtl ? 240 : 145;
  const teamTextAnchor = rtl ? "middle" : "start";
  const vsTextAnchor = rtl ? "middle" : "start";
  const badgeOneCenterX = rtl ? 90 : 310;
  const badgeTwoCenterX = rtl ? 330 : 70;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 300"
      width="100%"
      height="100%"
      aria-hidden="true"
      className="h-auto w-full"
    >
      <defs>
        <style>
          {`
            @keyframes landing-float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-12px); }
            }
            @keyframes landing-pulse {
              0% { transform: scale(0.95); opacity: 0.6; }
              50% { transform: scale(1.2); opacity: 1; }
              100% { transform: scale(0.95); opacity: 0.6; }
            }
            @keyframes landing-slide-in-right {
              0% { transform: translate(30px, 10px); opacity: 0; }
              100% { transform: translate(0, 0); opacity: 1; }
            }
            @keyframes landing-slide-in-left {
              0% { transform: translate(-30px, 10px); opacity: 0; }
              100% { transform: translate(0, 0); opacity: 1; }
            }
            @keyframes landing-slide-in-top {
              0% { transform: translate(-15px, -20px); opacity: 0; }
              100% { transform: translate(0, 0); opacity: 1; }
            }
            .landing-floating-card {
              animation: landing-float 6s ease-in-out infinite;
            }
            .landing-pulse-dot {
              animation: landing-pulse 2s infinite;
              transform-origin: center;
            }
            .landing-social-badge-1 {
              animation: landing-slide-in-right 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
              animation-delay: 0.5s;
              opacity: 0;
            }
            .landing-social-badge-1-rtl {
              animation: landing-slide-in-left 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
              animation-delay: 0.5s;
              opacity: 0;
            }
            .landing-social-badge-2 {
              animation: landing-slide-in-top 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
              animation-delay: 1.2s;
              opacity: 0;
            }
          `}
        </style>
        <filter
          id="landing-card-shadow"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="20"
            floodColor="#1E3A8A"
            floodOpacity="0.08"
          />
        </filter>
      </defs>

      <g transform={cardMirrorTransform}>
        <g className="landing-floating-card">
          <rect
            x="60"
            y="80"
            width="240"
            height="130"
            rx="16"
            fill="#FFFFFF"
            filter="url(#landing-card-shadow)"
          />
          <rect
            x="80"
            y="100"
            width="40"
            height="6"
            rx="3"
            fill="#94A3B8"
            opacity="0.3"
          />
          <circle
            cx="270"
            cy="103"
            r="4"
            fill="#F97316"
            className="landing-pulse-dot"
          />

          <rect x="80" y="165" width="55" height="24" rx="6" fill="#F1F5F9" />
          <rect x="145" y="165" width="55" height="24" rx="6" fill="#F1F5F9" />
          <rect x="210" y="165" width="55" height="24" rx="6" fill="#1E3A8A" />
        </g>
      </g>

      <text
        x={homeTeamX}
        y="140"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize="24"
        fill="#1E3A8A"
        textAnchor={teamTextAnchor}
      >
        MEX
      </text>
      <text
        x={vsX}
        y="138"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="#94A3B8"
        textAnchor={vsTextAnchor}
      >
        VS
      </text>
      <text
        x={awayTeamX}
        y="140"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize="24"
        fill="#1E3A8A"
        textAnchor={teamTextAnchor}
      >
        RSA
      </text>

      <g transform={cardMirrorTransform}>
        <g className={rtl ? "landing-social-badge-1-rtl" : "landing-social-badge-1"}>
          <circle
            cx="310"
            cy="180"
            r="24"
            fill="#FFFFFF"
            filter="url(#landing-card-shadow)"
          />
          <circle cx="310" cy="180" r="20" fill="#F1F5F9" />
          <circle
            cx="326"
            cy="164"
            r="7"
            fill="#10B981"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </g>
      </g>
      <text
        x={badgeOneCenterX}
        y="186"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#1E3A8A"
        textAnchor="middle"
      >
        B
      </text>

      <g transform={cardMirrorTransform}>
        <g className="landing-social-badge-2">
          <circle
            cx="70"
            cy="60"
            r="20"
            fill="#FFFFFF"
            filter="url(#landing-card-shadow)"
          />
          <circle cx="70" cy="60" r="16" fill="#F1F5F9" />
        </g>
      </g>
      <text
        x={badgeTwoCenterX}
        y="65"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="12"
        fill="#1E3A8A"
        textAnchor="middle"
      >
        O
      </text>
    </svg>
  );
}

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

  if (authUser && !nextPath) {
    const defaultRoomPath = await getDefaultRoomDashboardPath(authUser);
    if (defaultRoomPath) {
      redirect(defaultRoomPath);
    }
  }

  const isSignedIn = !!authUser;
  const locale = await getLocale();
  const isRtl = locale === "he";
  const t = await getTranslations("landing");
  const showSplitLayout = isSignedIn;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {!isSignedIn && (
          <section className="mx-auto flex w-full max-w-xl flex-col rounded-[32px] border border-[#dbe5f2] bg-white p-5 shadow-[0_24px_70px_rgba(30,58,138,0.10)] md:hidden">
            <div className="mx-auto w-full max-w-[19rem]">
              <LandingHeroIllustration rtl={isRtl} />
            </div>

            <div className="mt-2">
              <h1 className="max-w-sm text-3xl font-black leading-tight tracking-tight text-[#1E3A8A]">
                {t("loginTitle")}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                {t("loginSubtitle")}
              </p>
            </div>

            <div className="mt-6">
              <GoogleLoginButton redirectTo={nextPath || "/"} />
            </div>

            <footer className="mt-8 border-t border-[#e7eef8] pt-4 text-center text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-500">
              {t("kickoff")}
            </footer>
          </section>
        )}

        <div
          className={`w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] ${
            showSplitLayout ? "grid" : "hidden md:grid"
          }`}
        >
          <section className="flex min-h-[18rem] items-center justify-center rounded-[32px] border border-[#dbe5f2] bg-white p-4 shadow-[0_24px_70px_rgba(30,58,138,0.10)] sm:min-h-[22rem] sm:p-8">
            <div className="w-full max-w-[34rem]">
              <LandingHeroIllustration rtl={isRtl} />
            </div>
          </section>

          <section className="flex min-h-[22rem] flex-col rounded-[32px] border border-[#dbe5f2] bg-white p-6 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
            <div className="flex-1">
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
                <div className="flex h-full flex-col">
                  <div>
                    <h1 className="max-w-sm text-3xl font-black leading-tight tracking-tight text-[#1E3A8A]">
                      {t("loginTitle")}
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                      {t("loginSubtitle")}
                    </p>
                  </div>

                  <div className="mt-8">
                    <GoogleLoginButton redirectTo={nextPath || "/"} />
                  </div>
                </div>
              )}
            </div>

            <footer className="mt-8 border-t border-[#e7eef8] pt-4 text-center text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-500">
              {t("kickoff")}
            </footer>
          </section>
        </div>
      </main>
      <PublicSiteFooter />
    </>
  );
}
