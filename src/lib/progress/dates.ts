const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function manilaParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "29 Sep" (DESIGN §7), in Asia/Manila. */
export function formatDay(iso: string | number): string {
  const p = manilaParts(new Date(iso));
  return `${p.day} ${MONTHS[Number(p.month) - 1]}`;
}

/** "Wed 30 Sep, 08:03" (DESIGN §7), in Asia/Manila. */
export function formatDateTime(iso: string | number): string {
  const p = manilaParts(new Date(iso));
  return `${p.weekday} ${p.day} ${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
}
