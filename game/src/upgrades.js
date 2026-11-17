// The upgrade draft offered between waves: three cards, pick one (click or keys 1-3).
// Each card names what it does in one line; most can stack up to three times.
export const UPGRADES = [
  { id: 'damage', name: 'Ember Rounds', icon: '✦', max: 3,
    text: '+1 bolt damage', apply: (s) => { s.damage += 1; } },
  { id: 'rapid', name: 'Quick Wick', icon: '≫', max: 3,
    text: 'Shoot 18% faster', apply: (s) => { s.fireInterval *= 0.82; } },
  { id: 'multishot', name: 'Twin Flame', icon: '✧✧', max: 2,
    text: '+1 bolt per shot', apply: (s) => { s.shots += 1; } },
  { id: 'pierce', name: 'Piercing Light', icon: '➶', max: 2,
    text: 'Bolts pass through +1 foe', apply: (s) => { s.pierce += 1; } },
  { id: 'speed', name: 'Swift Boots', icon: '➤', max: 3,
    text: 'Move 12% faster', apply: (s) => { s.speed *= 1.12; } },
  { id: 'heart', name: 'Warm Hearth', icon: '♥', max: 3,
    text: '+1 max heart, heal 1', apply: (s) => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'dash', name: 'Cinder Step', icon: '↯', max: 2,
    text: 'Dash recharges 35% faster', apply: (s) => { s.dashCooldown *= 0.65; } },
  { id: 'magnet', name: 'Ember Magnet', icon: '◎', max: 2,
    text: 'Pick up embers from farther away', apply: (s) => { s.pickupRadius *= 1.6; } },
  { id: 'nova', name: 'Nova Cache', icon: '☀', max: 2,
    text: '+1 nova charge (Q)', apply: (s) => { s.novaMax += 1; s.nova = Math.min(s.novaMax, s.nova + 1); } },
  { id: 'velocity', name: 'Long Lantern', icon: '—›', max: 2,
    text: 'Bolts fly 25% faster and farther', apply: (s) => { s.bulletSpeed *= 1.25; s.bulletRange *= 1.25; } },
];

/** Draw three distinct upgrades the player has not maxed out, using the run's RNG. */
export function draftUpgrades(random, taken) {
  const available = UPGRADES.filter((u) => (taken[u.id] ?? 0) < u.max);
  const draft = [];
  while (draft.length < 3 && available.length > 0) {
    const index = Math.floor(random() * available.length);
    draft.push(available.splice(index, 1)[0]);
  }
  return draft;
}
