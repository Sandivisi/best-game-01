// A small seeded generator (mulberry32) so a screenshot seed always replays the same game.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry from a weighted list of [value, weight] pairs. */
export function pickWeighted(random, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
