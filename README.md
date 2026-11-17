# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Sandivisi/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Sandivisi/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Emberkeep — Lanterns of the Hollow Vale: an original top-down arena shooter. Survive 10 waves as the last lantern-keeper, then defeat the Gloom Sovereign.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

---

# Emberkeep — Lanterns of the Hollow Vale

A complete original browser game for make.fun's **best-game-01** bounty.
The vale has gone dark. You are its last lantern-keeper: hold the light
through 10 waves of shadow-foes, then face the Gloom Sovereign.

## How to play

- **WASD / arrow keys** — move
- **Mouse** — aim; **hold left click** (or Space) — shoot ember bolts
- **Shift / right-click** — dash (brief invulnerability)
- **Q** — nova blast, a radial burst (limited charges)
- **P / Esc** — pause · **M** — mute · **R** — restart

Between waves, pick one of three blessing cards (click, or keys 1–3):
more damage, faster fire, twin shots, piercing bolts, speed, hearts,
faster dash, ember magnet, extra nova charges, longer bolt range.
Walk close to the four corner braziers to kindle them (+150 points each
and a wider lantern glow). Kills build a combo multiplier; embers are
score and pickups. Win by clearing wave 10; lose when your hearts run out.
Best score is kept in `localStorage`.

## What is in the game

- 10 waves, 5 foe kinds (mite, wisp, spitter, brute, and the boss
  Gloom Sovereign with a radial bullet pattern and mite summons)
- 10 stackable upgrades drafted between waves
- Synthesized WebAudio sound effects and a generative arpeggio — no
  audio files, no network requests
- Particles, screen shake, hit-stop, floating score text, combo meter,
  boss health bar, dash/nova meters, pause, victory and defeat screens
- Deterministic screenshot scenes: `?shot=start|play|win|end&seed=N`
  (used for the screenshots in `screenshots/`)

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Or open `game/index.html` through any static server. The game is static
files only — no build step, no network request.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-game.ts` library.

## License

MIT — see `LICENSE`. All art, sound, names and code are original.
