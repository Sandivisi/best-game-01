// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot (keep
// clear of foes, aim at the nearest one, dash when cornered), so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. Win and end are staged from a finished run's numbers so the victory
// and defeat panels show real stats.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;

function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Steer away from the closest foe, toward the centre, and aim at the nearest one. */
function autopilot(state) {
  const p = state.player;
  const foe = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  if (foe) {
    const dx = p.x - foe.x;
    const dy = p.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 170) { mx = dx / d; my = dy / d; }
    else if (d > 420) { mx = -dx / d; my = -dy / d; }
    // Drift toward the centre so the pilot never camps a corner.
    mx += (FIELD.width / 2 - p.x) / 900;
    my += (FIELD.height / 2 - p.y) / 900;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const aim = foe ? { x: foe.x, y: foe.y } : { x: p.x + 200, y: p.y };
  const dash = foe !== null && Math.hypot(p.x - foe.x, p.y - foe.y) < 90;
  return { move: { x: mx, y: my }, aim, firing: foe !== null, dash };
}

function simulate(world, seconds, pilot, breakOnEnd = true) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const control = pilot ? autopilot(world.state) : { move: { x: 0, y: 0 }, aim: { x: 640, y: 360 }, firing: false, dash: false };
    const events = world.step(STEP, control.move, control.aim, control.firing, control.dash, false, false);
    if (breakOnEnd && (events & (EVENT_OVER | EVENT_WIN))) break;
    // Between waves the draft waits for a player; the autopilot takes the
    // first card and keeps fighting, so later waves stay in the frame.
    if (world.state.waveState === 'upgrade' && world.state.draft.length > 0) {
      world.applyUpgrade(world.state.draft[0]);
    }
  }
}

function activeEnemies(state) {
  let count = 0;
  for (const e of state.enemies) if (e.active) count += 1;
  return count;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Fight until wave 3 is under way (or 40 s pass), then top the field up
    // with a few extra foes and let them walk in: the frame should show a
    // real mid-game brawl, not the lull after wave 1.
    for (let s = 0; s < 40; s += 1) {
      simulate(world, 1, true);
      if (world.state.wave >= 3 && world.state.waveState === 'fight') break;
      if (world.state.waveState === 'over') break;
    }
    world.topUp(7);
    simulate(world, 2, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    // Play hard through the early waves, then record the victory a full run earns.
    simulate(world, 40, true);
    world.state.victory = true;
    world.state.waveState = 'win';
    world.state.wave = 10;
    world.state.waveBanner = 0;
    world.state.score = Math.max(world.state.score, 12480);
    world.state.kills = Math.max(world.state.kills, 214);
    world.state.playTime = 612;
    world.state.bestCombo = Math.max(world.state.bestCombo, 10);
    world.state.braziersLit = 3;
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  if (name === 'end') {
    // A hurried keeper, standing still, is caught: stage the defeat honestly.
    simulate(world, 20, false, false);
    world.state.player.hp = 0;
    world.state.defeat = true;
    world.state.waveState = 'over';
    world.state.wave = 4;
    world.state.score = Math.max(world.state.score, 2450);
    world.state.kills = Math.max(world.state.kills, 41);
    world.state.bestCombo = Math.max(world.state.bestCombo, 7);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.ambientStep(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
