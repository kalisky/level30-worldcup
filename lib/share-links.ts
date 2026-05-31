type CustomBetShareTarget = {
  roomCode: string;
  betId: string;
  matchId?: string | null;
};

export function getCustomBetInvitePath({
  roomCode,
  betId,
  matchId,
}: CustomBetShareTarget) {
  const params = new URLSearchParams({ bet: betId });
  if (matchId) params.set("match", matchId);
  return `/r/${roomCode}?${params.toString()}`;
}

export function getCustomBetTargetPath({
  roomCode,
  betId,
  matchId,
}: CustomBetShareTarget) {
  const params = new URLSearchParams({ bet: betId });
  const hash = `#custom-bet-${betId}`;
  const query = `?${params.toString()}`;

  return matchId
    ? `/r/${roomCode}/match/${matchId}${query}${hash}`
    : `/r/${roomCode}/dashboard${query}${hash}`;
}
