// ═══════════════════════════════════════════════════════════════════════════
// Animation API - GSAP wrapper for animating Zustand state paths
// ═══════════════════════════════════════════════════════════════════════════

import gsap from 'gsap';
import { useEngineState, StatePath } from '../../stores/useEngineState';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimateOptions {
  duration?: number;
  ease?: string;
  delay?: number;
  repeat?: number;
  yoyo?: boolean;
  onComplete?: () => void;
  onUpdate?: (value: number) => void;
}

export interface AnimateResult {
  tween: gsap.core.Tween;
  kill: () => void;
  pause: () => void;
  resume: () => void;
  reverse: () => void;
  progress: (value?: number) => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Animation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animate a state path from current value to target value
 * Uses GSAP for smooth, performant tweening
 *
 * @example
 * // Animate sun intensity over 1 second
 * animateTo(['lighting', 'sun', 'intensity'], 2.0, { duration: 1 })
 *
 * // Animate fog density with easing
 * animateTo(['environment', 'fog', 'density'], 0.1, { duration: 0.5, ease: 'power2.out' })
 */
export function animateTo(
  path: StatePath,
  target: number,
  options: AnimateOptions = {}
): AnimateResult {
  const store = useEngineState.getState();
  const current = store.getPath<number>(path);

  if (current === undefined) {
    console.warn(`[Animate] Path not found: ${path.join('.')}`);
    const dummy = gsap.to({}, { duration: 0 });
    return {
      tween: dummy,
      kill: () => dummy.kill(),
      pause: () => dummy.pause(),
      resume: () => dummy.resume(),
      reverse: () => dummy.reverse(),
      progress: (v) => v !== undefined ? (dummy.progress(v), v) : dummy.progress(),
    };
  }

  // Create a proxy object for GSAP to animate
  const proxy = { value: current };

  const tween = gsap.to(proxy, {
    value: target,
    duration: options.duration ?? 1,
    ease: options.ease ?? 'power2.inOut',
    delay: options.delay ?? 0,
    repeat: options.repeat ?? 0,
    yoyo: options.yoyo ?? false,
    onUpdate: () => {
      store.setPath(path, proxy.value, 'Animation');
      options.onUpdate?.(proxy.value);
    },
    onComplete: options.onComplete,
  });

  return {
    tween,
    kill: () => tween.kill(),
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    reverse: () => tween.reverse(),
    progress: (v) => v !== undefined ? (tween.progress(v), v) : tween.progress(),
  };
}

/**
 * Animate from a value to current value
 */
export function animateFrom(
  path: StatePath,
  from: number,
  options: AnimateOptions = {}
): AnimateResult {
  const store = useEngineState.getState();
  const current = store.getPath<number>(path);

  if (current === undefined) {
    console.warn(`[Animate] Path not found: ${path.join('.')}`);
    const dummy = gsap.to({}, { duration: 0 });
    return {
      tween: dummy,
      kill: () => dummy.kill(),
      pause: () => dummy.pause(),
      resume: () => dummy.resume(),
      reverse: () => dummy.reverse(),
      progress: (v) => v !== undefined ? (dummy.progress(v), v) : dummy.progress(),
    };
  }

  const proxy = { value: from };
  const target = current;

  // Set initial value
  store.setPath(path, from, 'Animation start');

  const tween = gsap.to(proxy, {
    value: target,
    duration: options.duration ?? 1,
    ease: options.ease ?? 'power2.inOut',
    delay: options.delay ?? 0,
    repeat: options.repeat ?? 0,
    yoyo: options.yoyo ?? false,
    onUpdate: () => {
      store.setPath(path, proxy.value, 'Animation');
      options.onUpdate?.(proxy.value);
    },
    onComplete: options.onComplete,
  });

  return {
    tween,
    kill: () => tween.kill(),
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    reverse: () => tween.reverse(),
    progress: (v) => v !== undefined ? (tween.progress(v), v) : tween.progress(),
  };
}

/**
 * Animate between two explicit values
 */
export function animateFromTo(
  path: StatePath,
  from: number,
  to: number,
  options: AnimateOptions = {}
): AnimateResult {
  const store = useEngineState.getState();

  const proxy = { value: from };

  // Set initial value
  store.setPath(path, from, 'Animation start');

  const tween = gsap.to(proxy, {
    value: to,
    duration: options.duration ?? 1,
    ease: options.ease ?? 'power2.inOut',
    delay: options.delay ?? 0,
    repeat: options.repeat ?? 0,
    yoyo: options.yoyo ?? false,
    onUpdate: () => {
      store.setPath(path, proxy.value, 'Animation');
      options.onUpdate?.(proxy.value);
    },
    onComplete: options.onComplete,
  });

  return {
    tween,
    kill: () => tween.kill(),
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    reverse: () => tween.reverse(),
    progress: (v) => v !== undefined ? (tween.progress(v), v) : tween.progress(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Array/Vector Animation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animate a vector (array of numbers) - useful for colors, positions, etc.
 *
 * @example
 * // Animate sun color to warm orange
 * animateVectorTo(['lighting', 'sun', 'color'], [1, 0.6, 0.2], { duration: 2 })
 */
export function animateVectorTo(
  path: StatePath,
  target: number[],
  options: AnimateOptions = {}
): AnimateResult {
  const store = useEngineState.getState();
  const current = store.getPath<number[]>(path);

  if (!current || !Array.isArray(current)) {
    console.warn(`[Animate] Vector path not found: ${path.join('.')}`);
    const dummy = gsap.to({}, { duration: 0 });
    return {
      tween: dummy,
      kill: () => dummy.kill(),
      pause: () => dummy.pause(),
      resume: () => dummy.resume(),
      reverse: () => dummy.reverse(),
      progress: (v) => v !== undefined ? (dummy.progress(v), v) : dummy.progress(),
    };
  }

  // Create proxy with indexed properties
  const proxy: Record<string, number> = {};
  current.forEach((val, i) => {
    proxy[`v${i}`] = val;
  });

  const targetObj: Record<string, number> = {};
  target.forEach((val, i) => {
    targetObj[`v${i}`] = val;
  });

  const tween = gsap.to(proxy, {
    ...targetObj,
    duration: options.duration ?? 1,
    ease: options.ease ?? 'power2.inOut',
    delay: options.delay ?? 0,
    repeat: options.repeat ?? 0,
    yoyo: options.yoyo ?? false,
    onUpdate: () => {
      const result = Object.keys(proxy)
        .sort()
        .map((key) => proxy[key]);
      store.setPath(path, result, 'Animation');
      options.onUpdate?.(result[0]);
    },
    onComplete: options.onComplete,
  });

  return {
    tween,
    kill: () => tween.kill(),
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    reverse: () => tween.reverse(),
    progress: (v) => v !== undefined ? (tween.progress(v), v) : tween.progress(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Support
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineItem {
  path: StatePath;
  target: number | number[];
  duration?: number;
  ease?: string;
  position?: string | number; // GSAP position parameter
}

/**
 * Create a GSAP timeline for sequenced animations
 *
 * @example
 * const tl = createTimeline()
 *   .add(['lighting', 'sun', 'intensity'], 0, { duration: 1 })
 *   .add(['environment', 'fog', 'density'], 0.1, { duration: 0.5, position: '-=0.5' })
 *   .add(['lighting', 'sun', 'intensity'], 1, { duration: 1 })
 *
 * // Control the timeline
 * tl.play()
 * tl.pause()
 * tl.reverse()
 */
export function createTimeline(defaults?: gsap.TimelineVars): TimelineBuilder {
  return new TimelineBuilder(defaults);
}

export class TimelineBuilder {
  private timeline: gsap.core.Timeline;

  constructor(defaults?: gsap.TimelineVars) {
    this.timeline = gsap.timeline(defaults);
  }

  /**
   * Add a scalar animation to the timeline
   */
  add(
    path: StatePath,
    target: number,
    options: AnimateOptions & { position?: string | number } = {}
  ): this {
    const store = useEngineState.getState();
    const current = store.getPath<number>(path);

    if (current === undefined) {
      console.warn(`[Timeline] Path not found: ${path.join('.')}`);
      return this;
    }

    const proxy = { value: current };

    this.timeline.to(
      proxy,
      {
        value: target,
        duration: options.duration ?? 1,
        ease: options.ease ?? 'power2.inOut',
        onUpdate: () => {
          store.setPath(path, proxy.value, 'Animation');
        },
      },
      options.position
    );

    return this;
  }

  /**
   * Add a vector animation to the timeline
   */
  addVector(
    path: StatePath,
    target: number[],
    options: AnimateOptions & { position?: string | number } = {}
  ): this {
    const store = useEngineState.getState();
    const current = store.getPath<number[]>(path);

    if (!current || !Array.isArray(current)) {
      console.warn(`[Timeline] Vector path not found: ${path.join('.')}`);
      return this;
    }

    const proxy: Record<string, number> = {};
    current.forEach((val, i) => {
      proxy[`v${i}`] = val;
    });

    const targetObj: Record<string, number> = {};
    target.forEach((val, i) => {
      targetObj[`v${i}`] = val;
    });

    this.timeline.to(
      proxy,
      {
        ...targetObj,
        duration: options.duration ?? 1,
        ease: options.ease ?? 'power2.inOut',
        onUpdate: () => {
          const result = Object.keys(proxy)
            .sort()
            .map((key) => proxy[key]);
          store.setPath(path, result, 'Animation');
        },
      },
      options.position
    );

    return this;
  }

  /**
   * Add a delay/pause to the timeline
   */
  wait(duration: number): this {
    this.timeline.to({}, { duration });
    return this;
  }

  /**
   * Add a callback to the timeline
   */
  call(callback: () => void, position?: string | number): this {
    this.timeline.call(callback, undefined, position);
    return this;
  }

  /**
   * Add a label for positioning
   */
  label(name: string, position?: string | number): this {
    this.timeline.addLabel(name, position);
    return this;
  }

  // Timeline controls
  play(): this {
    this.timeline.play();
    return this;
  }

  pause(): this {
    this.timeline.pause();
    return this;
  }

  resume(): this {
    this.timeline.resume();
    return this;
  }

  reverse(): this {
    this.timeline.reverse();
    return this;
  }

  restart(): this {
    this.timeline.restart();
    return this;
  }

  kill(): this {
    this.timeline.kill();
    return this;
  }

  progress(value?: number): number {
    if (value !== undefined) {
      this.timeline.progress(value);
      return value;
    }
    return this.timeline.progress();
  }

  duration(): number {
    return this.timeline.duration();
  }

  getTimeline(): gsap.core.Timeline {
    return this.timeline;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kill all active animations
 */
export function killAllAnimations(): void {
  gsap.killTweensOf('*');
}

/**
 * Get GSAP for advanced usage
 */
export function getGSAP(): typeof gsap {
  return gsap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export const Easing = {
  // Standard
  linear: 'none',
  smooth: 'power2.inOut',
  smoothIn: 'power2.in',
  smoothOut: 'power2.out',

  // Exponential
  expo: 'expo.inOut',
  expoIn: 'expo.in',
  expoOut: 'expo.out',

  // Elastic
  elastic: 'elastic.out(1, 0.3)',
  bounce: 'bounce.out',

  // Back (overshoot)
  back: 'back.inOut(1.7)',
  backIn: 'back.in(1.7)',
  backOut: 'back.out(1.7)',

  // Sine (gentle)
  sine: 'sine.inOut',
  sineIn: 'sine.in',
  sineOut: 'sine.out',

  // Circ
  circ: 'circ.inOut',
  circIn: 'circ.in',
  circOut: 'circ.out',
} as const;

// Export for use in scripting
export const Animate = {
  to: animateTo,
  from: animateFrom,
  fromTo: animateFromTo,
  vectorTo: animateVectorTo,
  timeline: createTimeline,
  killAll: killAllAnimations,
  gsap: getGSAP,
  Easing,
};

export default Animate;
