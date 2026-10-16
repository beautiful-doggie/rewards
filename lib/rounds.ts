export const PRIZES = [
  {
    name: 'K1 MUSE PI PRO',
    image: '/prizes/k1-muse-pi-pro.webp',
    rounds: '第 1、2 轮',
  },
  {
    name: 'K1 MUSE BOOK',
    image: '/prizes/k1-muse-book.webp',
    rounds: '第 3、4 轮',
  },
  {
    name: 'K3 PICO ITX',
    image: '/prizes/k3-pico-itx.webp',
    rounds: '第 5、6 轮',
  },
] as const;

export const ROUNDS = PRIZES.flatMap((prize) => [prize, prize]);
export const STORAGE_KEY = 'spacemit-lottery-2026-six-rounds-v1';
export const LEGACY_STORAGE_KEY = 'spacemit-lottery-2026-v1';
export type Winner = { number: number; prize: string; time: string };
export type LotteryState = {
  total: number;
  winners: Winner[];
  unissued: number[];
  unclaimed: number[];
};
export const INITIAL_STATE: LotteryState = {
  total: 150,
  winners: [],
  unissued: [],
  unclaimed: [],
};

export function isLotteryState(value: unknown): value is LotteryState {
  if (!value || typeof value !== 'object') return false;
  const s = value as LotteryState;
  const unissued = s.unissued ?? [];
  const unclaimed = s.unclaimed ?? [];
  return (
    Number.isInteger(s.total) &&
    s.total >= ROUNDS.length &&
    s.total <= 10000 &&
    Array.isArray(s.winners) &&
    s.winners.length <= ROUNDS.length &&
    s.winners.every(
      (w, i) =>
        w &&
        Number.isInteger(w.number) &&
        w.number >= 1 &&
        w.number <= s.total &&
        w.prize === ROUNDS[i].name &&
        typeof w.time === 'string' &&
        Number.isFinite(Date.parse(w.time)),
    ) &&
    new Set(s.winners.map((w) => w.number)).size === s.winners.length &&
    Array.isArray(unissued) &&
    unissued.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= s.total,
    ) &&
    new Set(unissued).size === unissued.length &&
    unissued.length <= s.total - ROUNDS.length &&
    s.winners.every((w) => !unissued.includes(w.number)) &&
    Array.isArray(unclaimed) &&
    unclaimed.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= s.total,
    ) &&
    new Set(unclaimed).size === unclaimed.length &&
    s.winners.every((w) => !unclaimed.includes(w.number))
  );
}

export function parseUnissuedNumbers(input: string, total: number): number[] {
  const value = input.trim();
  if (!value) return [];

  const numbers = new Set<number>();
  for (const part of value.split(/[，,]/)) {
    const token = part.trim();
    const match = /^(\d+)\s*(?:[-–—~]\s*(\d+))?$/.exec(token);
    if (!match) throw new Error('请使用号码或区间格式，例如 40-50, 83-100。');

    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first < 1 ||
      last < first ||
      last > total
    ) {
      throw new Error(`号码必须在 1–${total} 之间，且区间起始号码不能大于结束号码。`);
    }
    for (let number = first; number <= last; number++) numbers.add(number);
  }
  return [...numbers].sort((a, b) => a - b);
}

export function formatUnissuedNumbers(numbers: number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let end = i;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1)
      end++;
    ranges.push(
      end === i ? String(sorted[i]) : `${sorted[i]}-${sorted[end]}`,
    );
    i = end + 1;
  }
  return ranges.join(', ');
}

export function prizeImage(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? '/rewards'}${path}`;
}
