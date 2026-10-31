export function normalizeSteamInput(value: string) {
  return value.trim();
}

export function isPotentialSteamProfile(value: string) {
  const input = normalizeSteamInput(value);

  return (
    /^\d{17}$/.test(input) ||
    /steamcommunity\.com\/(id|profiles)\//i.test(input) ||
    /^[a-z0-9_-]{2,64}$/i.test(input)
  );
}

export function formatPlaytime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));

  if (safeMinutes < 60) {
    return `${safeMinutes} мин`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours < 10 && restMinutes > 0) {
    return `${hours} ч ${restMinutes} мин`;
  }

  return `${hours} ч`;
}
