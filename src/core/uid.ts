/** Short unique-ish id for log entries, e.g. `uid('net')` → `net_lq3k2_a1b2`. */
export function uid(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${time}_${rand}`;
}
