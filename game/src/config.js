// Emberkeep — Lanterns of the Hollow Vale.
// Tunable numbers for the whole game live here, so balance changes touch one file.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'emberkeep-best-score';
export const BEST_WAVE_KEY = 'emberkeep-best-wave';
export const TOTAL_WAVES = 10;
export const BOSS_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 5,
  fireInterval: 0.22,
  bulletSpeed: 640,
  bulletDamage: 1,
  dashSpeed: 760,
  dashTime: 0.16,
  dashCooldown: 1.6,
  novaMax: 3,
  pickupRadius: 90,
  invulnerable: 1.0,
};

export const ENEMY = {
  mite:   { hp: 2, speed: 118, radius: 15, score: 50,  embers: 1, damage: 1, color: '#ff7a5c' },
  wisp:   { hp: 1, speed: 205, radius: 11, score: 80,  embers: 1, damage: 1, color: '#c9a7ff' },
  spitter:{ hp: 3, speed: 82,  radius: 16, score: 120, embers: 2, damage: 1, color: '#7fe08a' },
  brute:  { hp: 9, speed: 58,  radius: 26, score: 250, embers: 3, damage: 2, color: '#ffb347' },
  boss:   { hp: 90, speed: 66, radius: 46, score: 5000, embers: 12, damage: 2, color: '#ff4d6d' },
};

// How many of each foe a wave brings, and how fast they trickle in.
export const WAVES = [
  { mite: 6,  wisp: 0, spitter: 0, brute: 0, interval: 1.15 },
  { mite: 9,  wisp: 3, spitter: 0, brute: 0, interval: 1.0 },
  { mite: 10, wisp: 5, spitter: 2, brute: 0, interval: 0.95 },
  { mite: 12, wisp: 6, spitter: 4, brute: 1, interval: 0.9 },
  { mite: 12, wisp: 8, spitter: 5, brute: 2, interval: 0.85 },
  { mite: 14, wisp: 9, spitter: 6, brute: 3, interval: 0.8 },
  { mite: 16, wisp: 10, spitter: 7, brute: 3, interval: 0.75 },
  { mite: 16, wisp: 12, spitter: 8, brute: 4, interval: 0.7 },
  { mite: 18, wisp: 12, spitter: 9, brute: 5, interval: 0.65 },
  { mite: 6,  wisp: 6, spitter: 4, brute: 2, boss: 1, interval: 0.9 },
];

export const PALETTE = {
  backdrop: '#0a0e1a',
  ground: '#1b2440',
  groundAlt: '#171f38',
  grid: '#28345c',
  text: '#f5eeda',
  muted: '#a8b3d1',
  gold: '#ffc857',
  ember: '#ff8c42',
  heart: '#ff5d73',
  panel: 'rgba(10, 14, 30, 0.92)',
  panelEdge: '#ffc857',
  brazier: '#ffb347',
  light: '#ffd98a',
};

export const FONT = "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif";
