// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade draft, paused, game over and victory.
//
// ?seed=N fixes the run. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, BEST_WAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_HEAL, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__emberkeep = { world, screen: () => scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest(BEST_KEY);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.waveStart();
    announce('Playing. Wave 1. Hold the light.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(BEST_KEY, best);
    }
    const waveReached = world.state.wave;
    if (waveReached > readBest(BEST_WAVE_KEY)) saveBest(BEST_WAVE_KEY, waveReached);
    if (won) audio.victory();
    else audio.defeat();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `The light goes out. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_HIT) {
      audio.playerHurt();
      announce(world.state.player.hp === 1 ? 'Hit. One heart left.' : `Hit. ${world.state.player.hp} hearts left.`);
    }
    if (events & EVENT_KILL) audio.enemyDie();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HEAL) audio.heal();
    if (events & EVENT_BOSS) { audio.boss(); announce('The Gloom Sovereign wakes.'); }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
    }
    if (events & EVENT_WIN) finishRun(true);
    else if (events & EVENT_OVER) finishRun(false);
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.ambientStep(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.direction();
    const aim = input.aim();
    const events = world.step(
      STEP, move, aim, input.firing(),
      Boolean(actions & ACTION_DASH), Boolean(actions & ACTION_NOVA), false,
    );
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
    } else if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      const choice = input.takeUpgradeChoice();
      const mouse = input.mouse();
      let picked = choice;
      // A click picks a card only on its press edge, so a held fire button
      // from the fight cannot spend the draft by accident.
      if (picked < 0 && (actions & ACTION_CONFIRM)) {
        const draft = world.state.draft;
        const total = draft.length * 300 + (draft.length - 1) * 36;
        const startX = (1280 - total) / 2;
        for (let i = 0; i < draft.length; i += 1) {
          const x = startX + i * 336;
          if (mouse.x >= x && mouse.x <= x + 300 && mouse.y >= 300 && mouse.y <= 510) picked = i;
        }
      }
      if (picked >= 0 && picked < world.state.draft.length) {
        const upgrade = world.state.draft[picked];
        world.applyUpgrade(upgrade);
        audio.upgrade();
        audio.waveStart();
        screen = SCREEN_PLAY;
        announce(`Blessing taken: ${upgrade.name}. Wave ${world.state.wave}.`);
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        // Edge-triggered actions (dash, nova) fire once, on the first sub-step.
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, screen === SCREEN_UPGRADE ? input.mouse() : null);
  }

  // A read-only hook for automated playtests: the world and the current screen.
  window.__emberkeep = { world, screen: () => screen };

  // Leaving the tab pauses a running game rather than letting foes close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  announce('Emberkeep. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
