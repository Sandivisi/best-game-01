// The game's rules and state, with no drawing and no browser in it: the keeper,
// the foes, bolts, pickups, braziers, waves and the boss. step() advances one
// fixed 1/60 s step and returns what happened as bit flags, so the caller can
// react (sounds, announcements) without the world knowing about screens.
// Nothing here allocates in the hot loop beyond pooled objects.
import { BOSS_WAVE, ENEMY, FIELD, PLAYER, TOTAL_WAVES, WAVES } from './config.js';
import { draftUpgrades } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_HEAL = 64;
export const EVENT_BOSS = 128;

const BRAZIER_SPOTS = [
  { x: 90, y: 90 }, { x: FIELD.width - 90, y: 90 },
  { x: 90, y: FIELD.height - 90 }, { x: FIELD.width - 90, y: FIELD.height - 90 },
];
const MAX_ENEMIES = 64;
const MAX_BULLETS = 96;
const MAX_PARTICLES = 220;
const MAX_PICKUPS = 60;
const MAX_FLOATERS = 24;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, radius: PLAYER.radius,
    aimX: 1, aimY: 0, fireTimer: 0, dashTimer: 0, dashCooldown: 0,
    dashX: 0, dashY: 0, invulnerable: 0, speed: PLAYER.speed,
    damage: PLAYER.bulletDamage, fireInterval: PLAYER.fireInterval,
    bulletSpeed: PLAYER.bulletSpeed, bulletRange: 560, shots: 1, pierce: 0,
    pickupRadius: PLAYER.pickupRadius, nova: PLAYER.novaMax, novaMax: PLAYER.novaMax,
    dashCooldownMax: PLAYER.dashCooldown,
  };
  const enemies = [];
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    enemies.push({ active: false, kind: 'mite', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 10, speed: 100, score: 0, embers: 0, damage: 1, t: 0, flash: 0, shootTimer: 0, dashTimer: 0, isBoss: false });
  }
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) {
    bullets.push({ active: false, friendly: true, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, traveled: 0, range: 500, radius: 5 });
  }
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff', gravity: 0 });
  }
  const pickups = [];
  for (let i = 0; i < MAX_PICKUPS; i += 1) {
    pickups.push({ active: false, kind: 'ember', x: 0, y: 0, vx: 0, vy: 0, t: 0, value: 1 });
  }
  const floaters = [];
  for (let i = 0; i < MAX_FLOATERS; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff', size: 16 });
  }
  const braziers = BRAZIER_SPOTS.map((s) => ({ x: s.x, y: s.y, lit: false, t: 0 }));

  const state = {
    player, enemies, bullets, particles, pickups, floaters, braziers,
    score: 0, embers: 0, kills: 0, wave: 1, waveState: 'title',
    waveTimer: 0, spawnTimer: 0, spawnQueue: [], elapsed: 0, playTime: 0,
    shake: 0, hitStop: 0, novaFlash: 0, draft: [], taken: {},
    boss: null, waveBanner: 0, waveBannerText: '', streak: 0, streakTimer: 0,
    bestCombo: 0, braziersLit: 0, victory: false, defeat: false,
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed, life = 0.5, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.life = life * (0.6 + random() * 0.6); p.maxLife = p.life;
      p.size = size * (0.6 + random() * 0.8); p.color = color; p.gravity = 60;
    }
  }

  function floater(x, y, text, color, size = 16) {
    const f = free(floaters);
    if (!f) return;
    f.active = true; f.x = x; f.y = y; f.life = 0.9; f.text = text; f.color = color; f.size = size;
  }

  function spawnPickup(x, y, kind, value) {
    const p = free(pickups);
    if (!p) return;
    const a = random() * Math.PI * 2;
    p.active = true; p.kind = kind; p.x = x; p.y = y;
    p.vx = Math.cos(a) * 90; p.vy = Math.sin(a) * 90; p.t = random() * 6; p.value = value;
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (!e) return null;
    const def = ENEMY[kind];
    e.active = true; e.kind = kind; e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.hp = def.hp; e.maxHp = def.hp; e.radius = def.radius; e.speed = def.speed;
    e.score = def.score; e.embers = def.embers; e.damage = def.damage;
    e.t = random() * 10; e.flash = 0; e.shootTimer = 1 + random(); e.dashTimer = 1 + random() * 2;
    e.isBoss = kind === 'boss';
    if (e.isBoss) state.boss = e;
    return e;
  }

  function spawnEdge(kind) {
    const side = Math.floor(random() * 4);
    const m = 30;
    let x; let y;
    if (side === 0) { x = random() * FIELD.width; y = -m; }
    else if (side === 1) { x = FIELD.width + m; y = random() * FIELD.height; }
    else if (side === 2) { x = random() * FIELD.width; y = FIELD.height + m; }
    else { x = -m; y = random() * FIELD.height; }
    // Never spawn on top of the keeper.
    if (dist2(x, y, player.x, player.y) < 260 * 260) { x = FIELD.width - x; y = FIELD.height - y; }
    return spawnEnemy(kind, x, y);
  }

  function buildWave(n) {
    const def = WAVES[n - 1];
    const queue = [];
    const kinds = ['mite', 'wisp', 'spitter', 'brute'];
    for (const kind of kinds) for (let i = 0; i < (def[kind] ?? 0); i += 1) queue.push(kind);
    if (def.boss) for (let i = 0; i < def.boss; i += 1) queue.push('boss');
    // Shuffle, but keep the boss last.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      if (queue[i] !== 'boss' && queue[j] !== 'boss') { const t = queue[i]; queue[i] = queue[j]; queue[j] = t; }
    }
    return queue;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = buildWave(n);
    state.spawnTimer = 0.8;
    state.waveState = 'fight';
    state.waveBanner = 2.2;
    state.waveBannerText = n === BOSS_WAVE ? 'FINAL WAVE — THE GLOOM SOVEREIGN' : `WAVE ${n} of ${TOTAL_WAVES}`;
    for (const b of braziers) { b.lit = false; b.t = 0; }
    state.braziersLit = 0;
    return n === BOSS_WAVE ? EVENT_BOSS : 0;
  }

  function reset() {
    Object.assign(player, {
      x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, fireTimer: 0, dashTimer: 0,
      dashCooldown: 0, invulnerable: 0, speed: PLAYER.speed,
      damage: PLAYER.bulletDamage, fireInterval: PLAYER.fireInterval,
      bulletSpeed: PLAYER.bulletSpeed, bulletRange: 560, shots: 1, pierce: 0,
      pickupRadius: PLAYER.pickupRadius, nova: PLAYER.novaMax, novaMax: PLAYER.novaMax,
      dashCooldownMax: PLAYER.dashCooldown,
    });
    for (const list of [enemies, bullets, particles, pickups, floaters]) {
      for (const o of list) o.active = false;
    }
    for (const b of braziers) { b.lit = false; b.t = 0; }
    state.score = 0; state.embers = 0; state.kills = 0; state.wave = 1;
    state.waveState = 'fight'; state.waveTimer = 0; state.spawnTimer = 0;
    state.spawnQueue = []; state.elapsed = 0; state.playTime = 0;
    state.shake = 0; state.hitStop = 0; state.novaFlash = 0; state.draft = [];
    state.taken = {}; state.boss = null; state.streak = 0; state.streakTimer = 0;
    state.bestCombo = 0; state.braziersLit = 0; state.victory = false; state.defeat = false;
    startWave(1);
  }

  function killEnemy(e, awardScore = true) {
    e.active = false;
    state.kills += 1;
    state.streak = Math.min(state.streak + 1, 10);
    state.streakTimer = 2.5;
    if (state.streak > state.bestCombo) state.bestCombo = state.streak;
    if (awardScore) {
      const bonus = state.streak >= 5 ? Math.floor(e.score * 0.25) : 0;
      state.score += e.score + bonus;
      if (bonus > 0) floater(e.x, e.y - 18, `COMBO x${state.streak}`, '#ffc857', 15);
    }
    burst(e.x, e.y, ENEMY[e.kind].color, e.isBoss ? 60 : 16, e.isBoss ? 320 : 220, 0.6, e.isBoss ? 5 : 3);
    burst(e.x, e.y, '#ffd98a', 8, 140, 0.4, 2);
    for (let i = 0; i < e.embers; i += 1) spawnPickup(e.x, e.y, 'ember', 1);
    if (random() < 0.06) spawnPickup(e.x, e.y, 'heart', 1);
    if (e.isBoss) {
      state.boss = null;
      state.shake = 0.6;
      for (let i = 0; i < 6; i += 1) spawnPickup(e.x + (random() - 0.5) * 120, e.y + (random() - 0.5) * 120, 'ember', 1);
    }
  }

  function hurtPlayer(damage) {
    if (player.invulnerable > 0 || player.dashTimer > 0) return EVENT_HIT;
    player.hp -= damage;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 0.35);
    state.streak = 0;
    burst(player.x, player.y, '#ff5d73', 18, 240, 0.5, 3);
    if (player.hp <= 0) {
      player.hp = 0;
      state.defeat = true;
      state.waveState = 'over';
      burst(player.x, player.y, '#ffd98a', 60, 320, 1.1, 4);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireNova() {
    if (player.nova <= 0 || state.waveState !== 'fight') return 0;
    player.nova -= 1;
    state.novaFlash = 0.35;
    state.shake = Math.max(state.shake, 0.3);
    burst(player.x, player.y, '#ffd98a', 40, 420, 0.7, 4);
    let events = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      if (dist2(e.x, e.y, player.x, player.y) < 300 * 300) {
        e.hp -= 4;
        e.flash = 0.15;
        if (e.hp <= 0) { killEnemy(e); events |= EVENT_KILL; }
      }
    }
    return events;
  }

  function shootBolt() {
    const spread = 0.14;
    for (let i = 0; i < player.shots; i += 1) {
      const b = free(bullets);
      if (!b) return;
      const off = (i - (player.shots - 1) / 2) * spread;
      const ca = Math.cos(off);
      const sa = Math.sin(off);
      const dx = player.aimX * ca - player.aimY * sa;
      const dy = player.aimX * sa + player.aimY * ca;
      b.active = true; b.friendly = true;
      b.x = player.x + dx * (player.radius + 8);
      b.y = player.y + dy * (player.radius + 8);
      b.vx = dx * player.bulletSpeed; b.vy = dy * player.bulletSpeed;
      b.damage = player.damage; b.pierce = player.pierce;
      b.traveled = 0; b.range = player.bulletRange; b.radius = 5;
    }
  }

  function stepEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    if (e.kind === 'mite') {
      e.vx = nx * e.speed; e.vy = ny * e.speed;
    } else if (e.kind === 'wisp') {
      // Zig-zag dashing: bursts of speed with a sideways weave.
      e.dashTimer -= dt;
      const weave = Math.sin(e.t * 7) * 0.7;
      const px = -ny * weave;
      const py = nx * weave;
      const sp = e.dashTimer > 0 ? e.speed * 1.7 : e.speed;
      e.vx = (nx + px) * sp * 0.8; e.vy = (ny + py) * sp * 0.8;
      if (e.dashTimer < -1.2) e.dashTimer = 0.5;
    } else if (e.kind === 'spitter') {
      if (d > 300) { e.vx = nx * e.speed; e.vy = ny * e.speed; }
      else if (d < 180) { e.vx = -nx * e.speed; e.vy = -ny * e.speed; }
      else { e.vx = 0; e.vy = 0; }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 460) {
        e.shootTimer = 2.2 + random() * 0.8;
        const b = free(bullets);
        if (b) {
          b.active = true; b.friendly = false;
          b.x = e.x + nx * e.radius; b.y = e.y + ny * e.radius;
          b.vx = nx * 240; b.vy = ny * 240;
          b.damage = 1; b.pierce = 0; b.traveled = 0; b.range = 520; b.radius = 6;
        }
      }
    } else if (e.kind === 'brute') {
      e.vx = nx * e.speed; e.vy = ny * e.speed;
    } else if (e.kind === 'boss') {
      e.vx = nx * e.speed; e.vy = ny * e.speed;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.5;
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + e.t;
          const b = free(bullets);
          if (!b) break;
          b.active = true; b.friendly = false;
          b.x = e.x; b.y = e.y;
          b.vx = Math.cos(a) * 190; b.vy = Math.sin(a) * 190;
          b.damage = 1; b.pierce = 0; b.traveled = 0; b.range = 600; b.radius = 7;
        }
      }
      // The Sovereign summons mites while it lives.
      e.dashTimer -= dt;
      if (e.dashTimer <= 0) {
        e.dashTimer = 6;
        spawnEnemy('mite', e.x + (random() - 0.5) * 160, e.y + (random() - 0.5) * 160);
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
  }

  /**
   * One fixed step. `move` is a normalized {x,y}, `aim` a field point, `firing`
   * and `dash` are booleans, `nova` requests a blast. In `ambient` mode (the
   * title backdrop) foes wander and nothing can hurt or score.
   */
  function step(dt, move, aim, firing, dash, nova, ambient) {
    let events = 0;
    state.elapsed += dt;
    if (state.waveState === 'fight') state.playTime += dt;
    if (state.hitStop > 0) { state.hitStop -= dt; return 0; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);
    if (state.novaFlash > 0) state.novaFlash -= dt;
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.streakTimer > 0) {
      state.streakTimer -= dt;
      if (state.streakTimer <= 0) state.streak = 0;
    }
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // Aim from the mouse (or the autopilot's target point).
    const adx = aim.x - player.x;
    const ady = aim.y - player.y;
    const ad = Math.hypot(adx, ady);
    if (ad > 4) { player.aimX = adx / ad; player.aimY = ady / ad; }

    if (state.waveState === 'fight' && !ambient) {
      if (dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldown = player.dashCooldownMax;
        const mx = move.x !== 0 || move.y !== 0 ? move : { x: player.aimX, y: player.aimY };
        const ml = Math.hypot(mx.x, mx.y) || 1;
        player.dashX = mx.x / ml; player.dashY = mx.y / ml;
        burst(player.x, player.y, '#ffd98a', 10, 160, 0.35, 3);
      }
      if (nova) events |= fireNova();
      if (player.dashTimer > 0) {
        player.dashTimer -= dt;
        player.x += player.dashX * PLAYER.dashSpeed * dt;
        player.y += player.dashY * PLAYER.dashSpeed * dt;
      } else {
        player.x += move.x * player.speed * dt;
        player.y += move.y * player.speed * dt;
      }
      player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));

      player.fireTimer -= dt;
      if (firing && player.fireTimer <= 0) {
        player.fireTimer = player.fireInterval;
        shootBolt();
      }
    }

    // Spawning.
    if (state.waveState === 'fight' && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = WAVES[state.wave - 1].interval;
        spawnEdge(state.spawnQueue.shift());
      }
    }

    // Braziers: walk close to kindle one — +150 points and a wider lantern glow.
    for (const b of braziers) {
      b.t += dt;
      if (!b.lit && dist2(player.x, player.y, b.x, b.y) < 70 * 70) {
        b.lit = true;
        state.braziersLit += 1;
        state.score += 150;
        floater(b.x, b.y - 30, '+150 BRAZIER LIT', '#ffb347', 16);
        burst(b.x, b.y, '#ffb347', 22, 200, 0.6, 3);
      }
    }

    // Enemies.
    let alive = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      alive += 1;
      stepEnemy(e, dt);
      if (ambient) continue;
      if (state.waveState === 'fight' && dist2(e.x, e.y, player.x, player.y) < (e.radius + player.radius - 2) ** 2) {
        const hurt = hurtPlayer(e.damage);
        events |= hurt;
        if (hurt & EVENT_OVER) return events;
        // The foe bounces off after landing its hit.
        e.x += (e.x - player.x) * 0.4;
        e.y += (e.y - player.y) * 0.4;
      }
    }

    // Bullets.
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20 || b.traveled > b.range) {
        b.active = false;
        continue;
      }
      if (b.friendly) {
        for (const e of enemies) {
          if (!e.active) continue;
          if (dist2(b.x, b.y, e.x, e.y) < (e.radius + b.radius) ** 2) {
            e.hp -= b.damage;
            e.flash = 0.12;
            burst(b.x, b.y, '#ffd98a', 5, 140, 0.3, 2);
            if (e.hp <= 0) {
              killEnemy(e);
              events |= EVENT_KILL;
              state.hitStop = e.isBoss ? 0.22 : 0.03;
            }
            if (b.pierce > 0) { b.pierce -= 1; }
            else { b.active = false; }
            break;
          }
        }
      } else if (state.waveState === 'fight' && !ambient) {
        if (dist2(b.x, b.y, player.x, player.y) < (player.radius + b.radius - 2) ** 2) {
          b.active = false;
          const hurt = hurtPlayer(b.damage);
          events |= hurt;
          if (hurt & EVENT_OVER) return events;
        }
      }
    }

    // Pickups drift, then fly to the keeper when close. Uncollected embers
    // fade after a while so the field never drowns in them.
    for (const p of pickups) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t > 15) { p.active = false; continue; }
      p.vx *= 0.94; p.vy *= 0.94;
      const d2 = dist2(p.x, p.y, player.x, player.y);
      if (d2 < player.pickupRadius * player.pickupRadius && state.waveState === 'fight') {
        const d = Math.sqrt(d2) || 1;
        p.vx += ((player.x - p.x) / d) * 900 * dt * 10;
        p.vy += ((player.y - p.y) / d) * 900 * dt * 10;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (state.waveState === 'fight' && d2 < (player.radius + 14) ** 2) {
        p.active = false;
        if (p.kind === 'ember') {
          state.embers += p.value;
          state.score += 10 * p.value;
          events |= EVENT_PICKUP;
        } else if (p.kind === 'heart' && player.hp < player.maxHp) {
          player.hp += 1;
          events |= EVENT_HEAL;
          floater(player.x, player.y - 28, '+1 HEART', '#ff5d73', 16);
        }
      }
    }

    // Particles and floating text.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    // Wave clear: queue empty and nothing left alive.
    if (state.waveState === 'fight' && !ambient && state.spawnQueue.length === 0 && alive === 0) {
      const clearBonus = 200 + state.wave * 100 + state.braziersLit * 50;
      state.score += clearBonus;
      if (state.wave >= TOTAL_WAVES) {
        state.victory = true;
        state.waveState = 'win';
        return events | EVENT_WIN;
      }
      state.waveState = 'upgrade';
      state.draft = draftUpgrades(random, state.taken);
      state.waveBanner = 0;
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  function applyUpgrade(upgrade) {
    upgrade.apply(player);
    state.taken[upgrade.id] = (state.taken[upgrade.id] ?? 0) + 1;
    state.draft = [];
    startWave(state.wave + 1);
  }

  function ambientStep(dt) {
    // Title backdrop: a few foes wander while the keeper stands by the lantern.
    let count = 0;
    for (const e of enemies) if (e.active) count += 1;
    if (count < 4) spawnEdge(count % 2 === 0 ? 'mite' : 'wisp');
    return step(dt, { x: 0, y: 0 }, { x: player.x + 200, y: player.y }, false, false, false, true);
  }

  // Stage a busy frame: bring in a few extra foes of the current wave's
  // kinds, so a screenshot catches the fight, not the lull between spawns.
  function topUp(count) {
    const def = WAVES[state.wave - 1];
    const kinds = [];
    for (const kind of ['mite', 'wisp', 'spitter', 'brute']) {
      for (let i = 0; i < (def[kind] ?? 0); i += 1) kinds.push(kind);
    }
    for (let i = 0; i < count && kinds.length > 0; i += 1) {
      spawnEdge(kinds[Math.floor(random() * kinds.length)]);
    }
  }

  reset();
  // The title screen wants a calm field, not wave 1 in progress.
  state.waveState = 'title';
  return { state, reset, step, startWave, applyUpgrade, ambientStep, topUp };
}
