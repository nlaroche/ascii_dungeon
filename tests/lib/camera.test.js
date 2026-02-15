import { describe, it, expect } from 'vitest';
import {
  createVCam,
  createController,
  updateController,
  transitionTo,
  addShake,
  getScreenOffset,
} from '../../src/lib/camera.js';

describe('createVCam', () => {
  it('returns defaults when no config', () => {
    const vcam = createVCam();
    expect(vcam.followTarget).toBeNull();
    expect(vcam.damping).toBe(5.0);
    expect(vcam.deadZoneX).toBe(1.5);
    expect(vcam.deadZoneY).toBe(1.0);
    expect(vcam.zoom).toBe(1.0);
  });

  it('applies custom config', () => {
    const target = { x: 10, y: 20 };
    const vcam = createVCam({ followTarget: target, damping: 3, zoom: 2.0 });
    expect(vcam.followTarget).toBe(target);
    expect(vcam.damping).toBe(3);
    expect(vcam.zoom).toBe(2.0);
  });
});

describe('createController', () => {
  it('initializes at follow target position', () => {
    const vcam = createVCam({ followTarget: { x: 5, y: 10 } });
    const ctrl = createController(vcam);
    expect(ctrl.x).toBe(5);
    expect(ctrl.y).toBe(10);
    expect(ctrl.shakeIntensity).toBe(0);
    expect(ctrl.blending).toBe(false);
  });

  it('defaults to (0,0) with no target', () => {
    const ctrl = createController(createVCam());
    expect(ctrl.x).toBe(0);
    expect(ctrl.y).toBe(0);
  });
});

describe('updateController', () => {
  it('converges toward target over time', () => {
    const target = { x: 20, y: 30 };
    const vcam = createVCam({ followTarget: target, damping: 10, deadZoneX: 0, deadZoneY: 0 });
    const ctrl = createController(vcam);
    // Start at target, then move target away
    ctrl.x = 0;
    ctrl.y = 0;

    // After several updates, should approach target
    for (let i = 0; i < 100; i++) {
      updateController(ctrl, 0.016);
    }
    expect(ctrl.x).toBeCloseTo(20, 0);
    expect(ctrl.y).toBeCloseTo(30, 0);
  });

  it('does not move when target is within dead zone', () => {
    const target = { x: 5, y: 10 };
    const vcam = createVCam({ followTarget: target, damping: 10, deadZoneX: 2, deadZoneY: 2 });
    const ctrl = createController(vcam);
    // Camera starts at target, move target slightly
    target.x = 6; // within deadZoneX=2
    target.y = 11; // within deadZoneY=2

    const startX = ctrl.x;
    const startY = ctrl.y;
    updateController(ctrl, 0.016);
    expect(ctrl.x).toBe(startX);
    expect(ctrl.y).toBe(startY);
  });

  it('follows when target exits dead zone', () => {
    const target = { x: 5, y: 10 };
    const vcam = createVCam({ followTarget: target, damping: 10, deadZoneX: 1, deadZoneY: 1 });
    const ctrl = createController(vcam);
    // Move target well outside dead zone
    target.x = 15;
    target.y = 20;

    updateController(ctrl, 0.1);
    expect(ctrl.x).toBeGreaterThan(5);
    expect(ctrl.y).toBeGreaterThan(10);
  });

  it('ignores dt <= 0', () => {
    const ctrl = createController(createVCam({ followTarget: { x: 100, y: 100 } }));
    ctrl.x = 0;
    updateController(ctrl, 0);
    expect(ctrl.x).toBe(0);
    updateController(ctrl, -1);
    expect(ctrl.x).toBe(0);
  });
});

describe('transitionTo', () => {
  it('blends between two VCams', () => {
    const vcam1 = createVCam({ followTarget: { x: 0, y: 0 }, zoom: 1.0 });
    const vcam2 = createVCam({ followTarget: { x: 100, y: 50 }, zoom: 2.0 });
    const ctrl = createController(vcam1);

    transitionTo(ctrl, vcam2, 1.0);
    expect(ctrl.blending).toBe(true);

    // Halfway through
    updateController(ctrl, 0.5);
    expect(ctrl.x).toBeGreaterThan(0);
    expect(ctrl.x).toBeLessThan(100);

    // Complete
    updateController(ctrl, 0.6);
    expect(ctrl.blending).toBe(false);
    expect(ctrl.vcam).toBe(vcam2);
  });
});

describe('addShake', () => {
  it('sets shake intensity', () => {
    const ctrl = createController(createVCam({ followTarget: { x: 0, y: 0 } }));
    addShake(ctrl, 2.0);
    expect(ctrl.shakeIntensity).toBe(2.0);
  });

  it('decays over time', () => {
    const ctrl = createController(createVCam({ followTarget: { x: 0, y: 0 } }));
    addShake(ctrl, 5.0);
    updateController(ctrl, 0.5);
    expect(ctrl.shakeIntensity).toBeLessThan(5.0);
    expect(ctrl.shakeIntensity).toBeGreaterThan(0);
  });

  it('takes max of current and new intensity', () => {
    const ctrl = createController(createVCam({ followTarget: { x: 0, y: 0 } }));
    addShake(ctrl, 3.0);
    addShake(ctrl, 1.0);
    expect(ctrl.shakeIntensity).toBe(3.0);
  });
});

describe('getScreenOffset', () => {
  it('centers camera on screen', () => {
    const ctrl = createController(createVCam({ followTarget: { x: 10, y: 5 } }));
    const result = getScreenOffset(ctrl, 800, 600, 12, 18);
    expect(result.offsetX).toBeCloseTo(800 / 2 - 10 * 12);
    expect(result.offsetY).toBeCloseTo(600 / 2 - 5 * 18);
    expect(result.zoom).toBe(1.0);
  });
});
