// ── Juice Engine ──
// A stateful effects manager for hitstop, screen shake, bump, squash/stretch,
// particles, flash, float text, and vignette pulse. No renderer dependency —
// outputs pure state for consumers to render.

import { COLORS } from './palette.js';

const PARTICLE_CHARS = ['*', '+', '~', "'", ',', '!', '`', '.', '^'];

/**
 * @param {object} [config]
 * @param {number} [config.intensity] Global intensity multiplier (0–2)
 * @returns {object} juice engine instance
 */
export function createJuiceEngine(config = {}) {
  let intensity = config.intensity ?? 1.0;
  let speedMultiplier = config.speed ?? 1.0;

  // ── Active effect state ──
  let hitstopRemaining = 0;

  let shakeTime = -1;
  let shakeAmplitude = 0;
  let shakeDecay = 15;
  let shakeFrequency = 40;

  const bumps = new Map();      // entityId → { x, y, elapsed, duration, startX, startY }
  const squashes = new Map();   // entityId → { axis, amount, elapsed, duration }
  const flashes = new Map();    // entityId → { color, framesLeft }

  let particles = [];
  let floatTexts = [];

  let vignetteIntensity = 0;
  let vignetteRemaining = 0;
  let vignetteDuration = 0;

  function scale(v) {
    return v * intensity;
  }

  const engine = {
    get intensity() { return intensity; },
    set intensity(v) { intensity = Math.max(0, v); },

    get speed() { return speedMultiplier; },
    set speed(v) { speedMultiplier = Math.max(0.1, v); },

    // ── Hitstop ──
    hitstop(durationMs) {
      hitstopRemaining = Math.max(hitstopRemaining, scale(durationMs) / 1000);
    },

    // ── Screen shake ──
    shake(amplitude, opts = {}) {
      shakeAmplitude = scale(amplitude);
      shakeDecay = opts.decay ?? 15;
      shakeFrequency = opts.frequency ?? 40;
      shakeTime = 0;
    },

    // ── Entity bump (sub-cell displacement) ──
    bump(entityId, dirX, dirY, opts = {}) {
      const distance = scale(opts.distance ?? 0.5);
      const duration = (opts.duration ?? 120) / 1000;
      bumps.set(entityId, {
        x: dirX * distance,
        y: dirY * distance,
        elapsed: 0,
        duration,
      });
    },

    // ── Squash & stretch ──
    squash(entityId, axis, amount, opts = {}) {
      const duration = (opts.duration ?? 100) / 1000;
      squashes.set(entityId, {
        axis,   // 'x' or 'y'
        amount: scale(amount),
        elapsed: 0,
        duration,
      });
    },

    // ── Particles ──
    particles(x, y, opts = {}) {
      const count = Math.round(scale(opts.count ?? 8));
      const speed = scale(opts.speed ?? 5);
      const spreadAngle = opts.spread ?? Math.PI * 0.6;
      const gravity = opts.gravity ?? 5;
      const chars = opts.chars ?? PARTICLE_CHARS;
      const color = opts.color ?? COLORS.particleDefault;
      const life = opts.life ?? 0.5;
      const baseAngle = opts.angle ?? 0;

      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
        const spd = speed * (0.5 + Math.random() * 0.5);
        particles.push({
          char: chars[Math.floor(Math.random() * chars.length)],
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          gravity,
          life,
          maxLife: life,
          color,
        });
      }
    },

    // ── Flash ──
    flash(entityId, color, frames) {
      flashes.set(entityId, {
        color: color ?? COLORS.flash,
        framesLeft: Math.round(scale(frames ?? 3)),
      });
    },

    // ── Float text ──
    floatText(x, y, text, opts = {}) {
      const color = opts.color ?? COLORS.damage;
      const life = opts.life ?? 0.8;
      floatTexts.push({
        text,
        x, y,
        vx: opts.vx ?? (Math.random() - 0.5) * 0.5,
        vy: opts.vy ?? -2.5,
        gravity: opts.gravity ?? 0,
        bounce: opts.bounce ?? 0.5,
        groundY: opts.groundY ?? y + 4,
        life,
        maxLife: life,
        color,
        colorEnd: opts.colorEnd ?? null,
        outlineColor: opts.outlineColor ?? COLORS.black,
        scale: opts.scale ?? 1.0,
        scaleStart: opts.scaleStart ?? null,
        bold: opts.bold ?? false,
        outline: opts.outline ?? false,
        damageFx: opts.damageFx ?? false,
      });
    },

    // ── Vignette pulse ──
    vignettePulse(vigIntensity, durationMs) {
      vignetteIntensity = scale(vigIntensity);
      vignetteDuration = durationMs / 1000;
      vignetteRemaining = vignetteDuration;
    },

    // ── Update (call each frame) ──
    update(dt) {
      const sDt = dt * speedMultiplier;

      // Hitstop
      if (hitstopRemaining > 0) {
        hitstopRemaining -= dt; // real time, not scaled
        if (hitstopRemaining < 0) hitstopRemaining = 0;
      }
      const frozen = hitstopRemaining > 0;

      // Screen shake
      let shakeX = 0, shakeY = 0;
      if (shakeTime >= 0) {
        shakeTime += sDt;
        const decay = Math.exp(-shakeTime * shakeDecay);
        if (decay < 0.01) {
          shakeTime = -1;
        } else {
          shakeX = shakeAmplitude * Math.sin(shakeTime * shakeFrequency) * decay;
          shakeY = shakeAmplitude * Math.cos(shakeTime * shakeFrequency * 0.9) * decay * 0.5;
        }
      }

      // Entity overrides
      const entityOverrides = {};

      // Bumps
      for (const [id, b] of bumps) {
        b.elapsed += sDt;
        const t = Math.min(b.elapsed / b.duration, 1);
        // Ease out then spring back
        const ease = t < 0.5
          ? 1 - (1 - t * 2) * (1 - t * 2)
          : 1 - (1 - (1 - (t - 0.5) * 2)) * (1 - (1 - (t - 0.5) * 2));
        const factor = t < 0.5 ? ease : 1 - ease;
        if (!entityOverrides[id]) entityOverrides[id] = {};
        entityOverrides[id].offsetX = b.x * factor;
        entityOverrides[id].offsetY = b.y * factor;
        if (t >= 1) bumps.delete(id);
      }

      // Squash & stretch
      for (const [id, s] of squashes) {
        s.elapsed += sDt;
        const t = Math.min(s.elapsed / s.duration, 1);
        // Spring-like: squash then overshoot then settle
        const wave = Math.sin(t * Math.PI * 2) * (1 - t);
        if (!entityOverrides[id]) entityOverrides[id] = {};
        if (s.axis === 'x') {
          entityOverrides[id].scaleX = 1 + s.amount * wave;
          entityOverrides[id].scaleY = 1 - s.amount * wave * 0.5;
        } else {
          entityOverrides[id].scaleY = 1 + s.amount * wave;
          entityOverrides[id].scaleX = 1 - s.amount * wave * 0.5;
        }
        if (t >= 1) squashes.delete(id);
      }

      // Flashes
      for (const [id, f] of flashes) {
        if (!entityOverrides[id]) entityOverrides[id] = {};
        entityOverrides[id].flashColor = f.color;
        f.framesLeft--;
        if (f.framesLeft <= 0) flashes.delete(id);
      }

      // Particles
      particles = particles.filter(p => {
        p.x += p.vx * sDt;
        p.y += p.vy * sDt;
        p.vy += p.gravity * sDt;
        p.life -= sDt;
        return p.life > 0;
      });

      // Float texts
      floatTexts = floatTexts.filter(ft => {
        ft.vy += ft.gravity * sDt;
        ft.x += ft.vx * sDt;
        ft.y += ft.vy * sDt;
        // Bounce off ground
        if (ft.gravity > 0 && ft.y >= ft.groundY && ft.vy > 0) {
          ft.y = ft.groundY;
          ft.vy *= -ft.bounce;
          ft.vx *= 0.8;
          if (Math.abs(ft.vy) < 0.5) ft.vy = 0;
        }
        ft.life -= sDt;
        return ft.life > 0;
      });

      // Vignette
      let vignette = 0;
      if (vignetteRemaining > 0) {
        vignetteRemaining -= sDt;
        if (vignetteRemaining < 0) vignetteRemaining = 0;
        const t = vignetteRemaining / vignetteDuration;
        vignette = vignetteIntensity * t;
      }

      return {
        frozen,
        shakeX,
        shakeY,
        vignette,
        particles,
        floatTexts,
        entityOverrides,
      };
    },

    // ── Reset ──
    reset() {
      hitstopRemaining = 0;
      shakeTime = -1;
      shakeAmplitude = 0;
      bumps.clear();
      squashes.clear();
      flashes.clear();
      particles = [];
      floatTexts = [];
      vignetteIntensity = 0;
      vignetteRemaining = 0;
      vignetteDuration = 0;
    },
  };

  return engine;
}
