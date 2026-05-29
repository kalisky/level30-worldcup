import Image from "next/image";
import { getTeamFallbackMark, getTeamFlagCode } from "@/lib/team-flags";

export default function TeamFlag({
  teamName,
  size = 40,
}: {
  teamName: string;
  size?: number;
}) {
  const flagCode = getTeamFlagCode(teamName);
  const fallbackMark = getTeamFallbackMark(teamName);

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d8e3f1] bg-[#eff6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
      style={{ width: size, height: size }}
    >
      {flagCode ? (
        <Image
          src={`https://flagcdn.com/w80/${flagCode}.png`}
          alt={`${teamName} flag`}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-[#1E3A8A]">
          {fallbackMark}
        </span>
      )}
    </span>
  );
}
