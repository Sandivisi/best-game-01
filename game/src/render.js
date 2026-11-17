// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The vale is
// dark; the keeper's lantern lights a warm circle around them, braziers glow,
// and every hit, kill and pickup leaves particles and floating text.
import { BOSS_WAVE, ENEMY, FIELD, FONT, PALETTE, TOTAL_WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD = { width: 300, height: 210, gap: 36, top: 300 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) { value = next; text = prefix + next; }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const emberLabel = cachedLabel('✦ ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const killsLabel = cachedLabel('FOES FELLED ');
  const timeLabel = cachedLabel('TIME ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function drawField(state) {
    const time = state.elapsed;
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stone tiles.
    context.fillStyle = PALETTE.groundAlt;
    for (let ty = 0; ty < 6; ty += 1) {
      for (let tx = 0; tx < 10; tx += 1) {
        if ((tx + ty) % 2 === 0) context.fillRect(tx * 128, ty * 120, 128, 120);
      }
    }
    // Faint grid and moss speckles.
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 128) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, FIELD.height); context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 120) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(FIELD.width, y); context.stroke();
    }

    // Braziers in the four corners.
    for (const b of state.braziers) {
      const flicker = 1 + Math.sin(time * 6 + b.x) * 0.12;
      const glow = context.createRadialGradient(b.x, b.y, 4, b.x, b.y, 90 * flicker);
      glow.addColorStop(0, b.lit ? 'rgba(255, 179, 71, 0.55)' : 'rgba(120, 130, 160, 0.18)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      context.fillStyle = glow;
      context.fillRect(b.x - 90, b.y - 90, 180, 180);
      context.fillStyle = '#3a2c1c';
      context.fillRect(b.x - 14, b.y - 4, 28, 20);
      circle(b.x, b.y - 8, b.lit ? 11 * flicker : 7, b.lit ? '#ffcf5e' : '#5a6478');
      if (b.lit) circle(b.x, b.y - 8, 5, '#fff3c4');
      if (!b.lit) text('walk close to kindle', b.x, b.y + 40, 13, PALETTE.muted, 'center');
    }

    // Pickups.
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(p.t * 5) * 3;
      if (p.kind === 'ember') {
        circle(p.x, p.y + bob, 7, '#ff8c42');
        circle(p.x, p.y + bob, 3.5, '#ffd98a');
      } else {
        context.fillStyle = PALETTE.heart;
        context.beginPath();
        context.arc(p.x - 4, p.y + bob - 2, 5, 0, Math.PI * 2);
        context.arc(p.x + 4, p.y + bob - 2, 5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 8, p.y + bob);
        context.lineTo(p.x + 8, p.y + bob);
        context.lineTo(p.x, p.y + bob + 9);
        context.closePath();
        context.fill();
      }
    }

    // Enemy bolts (green orbs) and keeper bolts (gold streaks).
    for (const b of state.bullets) {
      if (!b.active) continue;
      if (b.friendly) {
        context.strokeStyle = '#ffe9a8';
        context.lineWidth = 4;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
        context.lineTo(b.x, b.y);
        context.stroke();
        circle(b.x, b.y, 3, '#fff3c4');
      } else {
        circle(b.x, b.y, b.radius + 2, 'rgba(127, 224, 138, 0.35)');
        circle(b.x, b.y, b.radius, '#7fe08a');
      }
    }

    // Foes.
    for (const e of state.enemies) {
      if (!e.active) continue;
      const def = ENEMY[e.kind];
      const wobble = Math.sin(e.t * 6) * 2;
      if (e.flash > 0) {
        circle(e.x, e.y, e.radius + 2, '#ffffff');
      } else {
        circle(e.x, e.y, e.radius + 3, 'rgba(0,0,0,0.35)');
        circle(e.x, e.y, e.radius, def.color);
      }
      if (e.kind === 'mite') {
        circle(e.x - 5, e.y - 3, 3, '#2a0f0a');
        circle(e.x + 5, e.y - 3, 3, '#2a0f0a');
        context.strokeStyle = '#2a0f0a';
        context.lineWidth = 2;
        context.beginPath(); context.moveTo(e.x - 5, e.y + 6); context.lineTo(e.x + 5, e.y + 6); context.stroke();
      } else if (e.kind === 'wisp') {
        circle(e.x, e.y, e.radius * 0.55, '#efe6ff');
        circle(e.x - 3, e.y - 2, 2, '#3a2a5e');
        circle(e.x + 3, e.y - 2, 2, '#3a2a5e');
      } else if (e.kind === 'spitter') {
        circle(e.x, e.y - 4, 4, '#12351a');
        circle(e.x, e.y + 5, 6, '#12351a');
      } else if (e.kind === 'brute') {
        context.strokeStyle = '#5e3a00';
        context.lineWidth = 3;
        context.beginPath(); context.arc(e.x, e.y, e.radius - 6, 0, Math.PI * 2); context.stroke();
        circle(e.x - 7, e.y - 4, 3, '#2a0f0a');
        circle(e.x + 7, e.y - 4, 3, '#2a0f0a');
      } else if (e.kind === 'boss') {
        // Crown of thorns and a baleful eye.
        context.strokeStyle = '#7a1030';
        context.lineWidth = 4;
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + e.t * 0.4;
          context.beginPath();
          context.moveTo(e.x + Math.cos(a) * (e.radius - 2), e.y + Math.sin(a) * (e.radius - 2));
          context.lineTo(e.x + Math.cos(a) * (e.radius + 12 + wobble), e.y + Math.sin(a) * (e.radius + 12 + wobble));
          context.stroke();
        }
        circle(e.x, e.y, 16, '#fff0f0');
        circle(e.x, e.y, 8, '#c40f3a');
      }
      // Health bar for hurt foes and the boss.
      if (e.hp < e.maxHp) {
        const w = e.isBoss ? 90 : e.radius * 2;
        context.fillStyle = 'rgba(0,0,0,0.6)';
        context.fillRect(e.x - w / 2, e.y - e.radius - 14, w, 6);
        context.fillStyle = e.isBoss ? '#ff4d6d' : '#ffc857';
        context.fillRect(e.x - w / 2, e.y - e.radius - 14, w * (e.hp / e.maxHp), 6);
      }
    }

    // The keeper: a hooded lantern-bearer, lantern swinging toward the aim.
    const p = state.player;
    if (!(p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0)) {
      const dashing = p.dashTimer > 0;
      circle(p.x, p.y, p.radius + (dashing ? 4 : 0), dashing ? '#ffe9a8' : '#2e6f8e');
      circle(p.x, p.y, p.radius - 4, '#7ec8e3');
      // Hood and face.
      circle(p.x, p.y - 3, 6, '#f5eeda');
      circle(p.x - 2, p.y - 4, 1.6, '#1a2440');
      circle(p.x + 3, p.y - 4, 1.6, '#1a2440');
      // Lantern held out toward the aim.
      const lx = p.x + p.aimX * 26;
      const ly = p.y + p.aimY * 26;
      const glow = context.createRadialGradient(lx, ly, 2, lx, ly, 26);
      glow.addColorStop(0, 'rgba(255, 217, 138, 0.9)');
      glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
      context.fillStyle = glow;
      context.fillRect(lx - 26, ly - 26, 52, 52);
      circle(lx, ly, 6, '#ffc857');
      circle(lx, ly, 3, '#fff3c4');
    }

    // Particles.
    for (const pt of state.particles) {
      if (!pt.active) continue;
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      circle(pt.x, pt.y, pt.size, pt.color);
    }
    context.globalAlpha = 1;

    // Floating text.
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life * 2);
      text(f.text, f.x, f.y, f.size, f.color, 'center', 'bold');
    }
    context.globalAlpha = 1;

    // Darkness: everything outside the lantern's light dims, but the vale
    // stays readable — the light is a mood, not a blindfold.
    const lightR = 380 + state.braziersLit * 40;
    const dark = context.createRadialGradient(p.x, p.y, lightR * 0.5, p.x, p.y, lightR + 220);
    dark.addColorStop(0, 'rgba(4, 6, 14, 0)');
    dark.addColorStop(1, 'rgba(4, 6, 14, 0.5)');
    context.fillStyle = dark;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (state.novaFlash > 0) {
      context.fillStyle = `rgba(255, 233, 168, ${state.novaFlash * 1.4})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHud(state) {
    const p = state.player;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left', 'bold');
    text(emberLabel(state.embers), 24, 50, 20, PALETTE.gold, 'left');
    text(waveLabel(`${state.wave} / ${TOTAL_WAVES}`), FIELD.width / 2, 18, 26, PALETTE.text, 'center', 'bold');
    // Hearts.
    for (let i = 0; i < p.maxHp; i += 1) {
      const x = FIELD.width - 24 - (p.maxHp - i) * 30;
      const y = 26;
      context.fillStyle = i < p.hp ? PALETTE.heart : 'rgba(255,93,115,0.25)';
      context.beginPath();
      context.arc(x - 5, y, 6, 0, Math.PI * 2);
      context.arc(x + 5, y, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - 10, y + 2);
      context.lineTo(x + 10, y + 2);
      context.lineTo(x, y + 13);
      context.closePath();
      context.fill();
    }
    // Dash and nova meters, bottom left.
    text('DASH', 24, FIELD.height - 44, 15, PALETTE.muted, 'left', 'bold');
    const dashFrac = p.dashCooldown <= 0 ? 1 : 1 - p.dashCooldown / p.dashCooldownMax;
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(78, FIELD.height - 40, 120, 10);
    context.fillStyle = dashFrac >= 1 ? '#7ec8e3' : '#4a7a96';
    context.fillRect(78, FIELD.height - 40, 120 * dashFrac, 10);
    text(`NOVA ×${p.nova}`, 220, FIELD.height - 44, 15, p.nova > 0 ? '#ffd98a' : PALETTE.muted, 'left', 'bold');
    // Boss bar.
    if (state.boss && state.boss.active) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      text('THE GLOOM SOVEREIGN', FIELD.width / 2, 56, 18, '#ff8fa3', 'center', 'bold');
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x, 80, w, 12);
      context.fillStyle = '#ff4d6d';
      context.fillRect(x, 80, w * (state.boss.hp / state.boss.maxHp), 12);
    }
    // Combo.
    if (state.streak >= 3) {
      text(`COMBO ×${state.streak}`, FIELD.width - 24, 56, 20, '#ffc857', 'right', 'bold');
    }
    // Wave banner.
    if (state.waveBanner > 0) {
      context.globalAlpha = Math.min(1, state.waveBanner);
      text(state.waveBannerText, FIELD.width / 2, 150, 40, PALETTE.gold, 'center', 'bold');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent = PALETTE.gold) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, 44, PALETTE.text, 'center', 'bold');
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + 128 + i * 32, 20, PALETTE.muted, 'center'));
    if (prompt) text(prompt, FIELD.width / 2, y + height - 28, 22, accent, 'center', 'bold');
  }

  function drawUpgradeCards(state, hover) {
    const draft = state.draft;
    const total = draft.length * CARD.width + (draft.length - 1) * CARD.gap;
    const startX = (FIELD.width - total) / 2;
    text('WAVE CLEARED — CHOOSE A BLESSING', FIELD.width / 2, 150, 34, PALETTE.gold, 'center', 'bold');
    text(`Wave ${state.wave} done. Score ${state.score} · ${state.embers} embers banked`, FIELD.width / 2, 196, 20, PALETTE.muted, 'center');
    draft.forEach((card, i) => {
      const x = startX + i * (CARD.width + CARD.gap);
      const y = CARD.top;
      const isHover = hover && hover.x >= x && hover.x <= x + CARD.width && hover.y >= y && hover.y <= y + CARD.height;
      context.fillStyle = isHover ? 'rgba(255, 200, 87, 0.16)' : PALETTE.panel;
      context.fillRect(x, y, CARD.width, CARD.height);
      context.strokeStyle = isHover ? PALETTE.gold : '#3a4a72';
      context.lineWidth = isHover ? 3 : 2;
      context.strokeRect(x, y, CARD.width, CARD.height);
      text(card.icon, x + CARD.width / 2, y + 62, 40, PALETTE.gold, 'center');
      text(card.name, x + CARD.width / 2, y + 104, 24, PALETTE.text, 'center', 'bold');
      text(card.text, x + CARD.width / 2, y + 138, 18, PALETTE.muted, 'center');
      text(`Press ${i + 1} or click`, x + CARD.width / 2, y + CARD.height - 22, 16, PALETTE.gold, 'center');
    });
  }

  const TITLE_LINES = [
    'The vale has gone dark. You are its last lantern-keeper.',
    'Hold the light through 10 waves — then face the Gloom Sovereign.',
    'Kindle the corner braziers for bonus points and a wider glow.',
    'WASD / arrows move · mouse aims · hold click to shoot',
    'Shift / right-click dash · Q nova blast · P pause · M mute',
  ];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, hover) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('EMBERKEEP', [...TITLE_LINES, best > 0 ? `Best score ${best}` : ''], 'Press Space or click to begin', PALETTE.gold);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_UPGRADE) {
      drawUpgradeCards(state, hover);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The dark waits patiently.', `Wave ${state.wave} · Score ${state.score}`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE LIGHT GOES OUT', [
        finalLabel(state.score),
        `Wave ${state.wave} of ${TOTAL_WAVES} · ${killsLabel(state.kills)}`,
        `Best combo ×${state.bestCombo} · Best score ${best}`,
      ], 'Press Space or click to try again', '#ff5d73');
    } else if (screen === SCREEN_WIN) {
      const minutes = Math.floor(state.playTime / 60);
      const seconds = Math.floor(state.playTime % 60).toString().padStart(2, '0');
      drawPanel('THE VALE SHINES AGAIN', [
        finalLabel(state.score),
        `${killsLabel(state.kills)} · ${timeLabel(`${minutes}:${seconds}`)}`,
        `Best combo ×${state.bestCombo} · ${state.braziersLit} braziers lit · Best score ${best}`,
      ], 'Press Space or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
