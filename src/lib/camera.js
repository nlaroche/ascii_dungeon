/**
 * Cinemachine-style camera system (pure functions).
 *
 * VCam — virtual camera config (follow target, damping, dead zone, zoom, shake)
 * Controller — mutable state for active camera (position, blend, shake)
 */

/**
 * Create a virtual camera configuration.
 * @param {object} config
 * @returns {object} VCam config
 */
export function createVCam(config = {}) {
  return {
    followTarget: config.followTarget ?? null, // { x, y } or null
    damping: config.damping ?? 5.0,            // higher = snappier follow
    deadZoneX: config.deadZoneX ?? 1.5,        // cells: no follow within this X radius
    deadZoneY: config.deadZoneY ?? 1.0,        // cells: no follow within this Y radius
    zoom: config.zoom ?? 1.0,                  // 1.0 = normal
  };
}

/**
 * Create a camera controller (mutable state).
 * @param {object} vcam - initial VCam config
 * @returns {object} controller state
 */
export function createController(vcam) {
  const target = vcam.followTarget || { x: 0, y: 0 };
  return {
    vcam,
    x: target.x,
    y: target.y,
    zoom: vcam.zoom,
    // Shake state
    shakeIntensity: 0,
    shakeDecay: 8.0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    // Blend/transition state
    blending: false,
    blendFrom: null, // { x, y, zoom }
    blendTo: null,   // VCam
    blendElapsed: 0,
    blendDuration: 0,
  };
}

/**
 * Tick the camera controller.
 * @param {object} ctrl - controller state (mutated in place)
 * @param {number} dt - delta time in seconds
 * @returns {object} ctrl (same reference, mutated)
 */
export function updateController(ctrl, dt) {
  if (dt <= 0) return ctrl;

  // ── Blend transition ──
  if (ctrl.blending) {
    ctrl.blendElapsed += dt;
    const t = Math.min(ctrl.blendElapsed / ctrl.blendDuration, 1.0);
    // Smooth ease in-out
    const eased = t * t * (3 - 2 * t);

    ctrl.x = ctrl.blendFrom.x + (ctrl.blendTo.followTarget.x - ctrl.blendFrom.x) * eased;
    ctrl.y = ctrl.blendFrom.y + (ctrl.blendTo.followTarget.y - ctrl.blendFrom.y) * eased;
    ctrl.zoom = ctrl.blendFrom.zoom + (ctrl.blendTo.zoom - ctrl.blendFrom.zoom) * eased;

    if (t >= 1.0) {
      ctrl.blending = false;
      ctrl.vcam = ctrl.blendTo;
      ctrl.blendFrom = null;
      ctrl.blendTo = null;
    }

    updateShake(ctrl, dt);
    return ctrl;
  }

  // ── Normal follow with dead zone + damping ──
  const vcam = ctrl.vcam;
  const target = vcam.followTarget;
  if (target) {
    let dx = target.x - ctrl.x;
    let dy = target.y - ctrl.y;

    // Dead zone: only follow when target exits the zone
    if (Math.abs(dx) < vcam.deadZoneX) dx = 0;
    else dx -= Math.sign(dx) * vcam.deadZoneX;

    if (Math.abs(dy) < vcam.deadZoneY) dy = 0;
    else dy -= Math.sign(dy) * vcam.deadZoneY;

    // Exponential damping (framerate-independent)
    const factor = 1 - Math.exp(-vcam.damping * dt);
    ctrl.x += dx * factor;
    ctrl.y += dy * factor;
  }

  ctrl.zoom = vcam.zoom;

  updateShake(ctrl, dt);
  return ctrl;
}

function updateShake(ctrl, dt) {
  if (ctrl.shakeIntensity > 0.001) {
    ctrl.shakeOffsetX = (Math.random() * 2 - 1) * ctrl.shakeIntensity;
    ctrl.shakeOffsetY = (Math.random() * 2 - 1) * ctrl.shakeIntensity;
    ctrl.shakeIntensity *= Math.exp(-ctrl.shakeDecay * dt);
  } else {
    ctrl.shakeIntensity = 0;
    ctrl.shakeOffsetX = 0;
    ctrl.shakeOffsetY = 0;
  }
}

/**
 * Start a cinematic blend from current camera to a new VCam.
 * @param {object} ctrl - controller state
 * @param {object} newVCam - target VCam config
 * @param {number} duration - blend duration in seconds
 */
export function transitionTo(ctrl, newVCam, duration = 1.0) {
  ctrl.blending = true;
  ctrl.blendFrom = { x: ctrl.x, y: ctrl.y, zoom: ctrl.zoom };
  ctrl.blendTo = newVCam;
  ctrl.blendElapsed = 0;
  ctrl.blendDuration = duration;
}

/**
 * Add screen shake to the camera.
 * @param {object} ctrl - controller state
 * @param {number} intensity - shake strength in cells
 */
export function addShake(ctrl, intensity) {
  ctrl.shakeIntensity = Math.max(ctrl.shakeIntensity, intensity);
}

/**
 * Compute pixel offset for centering the camera on screen.
 * @param {object} ctrl - controller state
 * @param {number} canvasW - canvas CSS width
 * @param {number} canvasH - canvas CSS height
 * @param {number} cellW - cell pixel width
 * @param {number} cellH - cell pixel height
 * @returns {{ offsetX: number, offsetY: number, zoom: number }}
 */
export function getScreenOffset(ctrl, canvasW, canvasH, cellW, cellH) {
  const cx = ctrl.x + ctrl.shakeOffsetX;
  const cy = ctrl.y + ctrl.shakeOffsetY;
  return {
    offsetX: canvasW / 2 - cx * cellW,
    offsetY: canvasH / 2 - cy * cellH,
    zoom: ctrl.zoom,
  };
}
