import { getTeamFallbackMark, getTeamFlagEmoji } from "@/lib/team-flags";

export default function TeamFlag({
  teamName,
  size = 40,
}: {
  teamName: string;
  size?: number;
}) {
  const flagEmoji = getTeamFlagEmoji(teamName);
  const fallbackMark = getTeamFallbackMark(teamName);
  const textSize = Math.max(12, Math.round(size * 0.58));
  const fallbackSize = Math.max(9, Math.round(size * 0.28));

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d8e3f1] bg-[#eff6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
      role="img"
      aria-label={`${teamName} flag`}
      style={{ width: size, height: size }}
    >
      {flagEmoji ? (
        <span
          aria-hidden="true"
          className="select-none leading-none"
          style={{ fontSize: textSize, lineHeight: 1 }}
        >
          {flagEmoji}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="font-black uppercase tracking-[0.18em] text-[#1E3A8A]"
          style={{ fontSize: fallbackSize }}
        >
          {fallbackMark}
        </span>
      )}
    </span>
  );
}
