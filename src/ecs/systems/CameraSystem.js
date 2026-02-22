/**
 * CameraSystem — follows the camera target entity with damping and dead zone.
 * Wraps camera.js updateController(). Reads CameraTarget component from player.
 *
 * @example
 * world.addSystem('camera', CameraSystem);
 */

import { COMPONENTS } from '../components.js';
import { createVCam, createController, updateController, addShake } from '../../lib/camera.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function CameraSystem(world, dt) {
  let camera = world.getResource('camera');

  // Find camera target entity
  const targets = world.query([COMPONENTS.POSITION, COMPONENTS.CAMERA_TARGET]);
  let targetEntity = null;
  for (const id of targets) {
    targetEntity = id;
    break;
  }

  if (!targetEntity) return;

  const pos = world.getComponent(targetEntity, COMPONENTS.POSITION);
  const camConfig = world.getComponent(targetEntity, COMPONENTS.CAMERA_TARGET);

  // Initialize camera controller if needed
  if (!camera) {
    const vcam = createVCam({
      followTarget: pos,
      damping: camConfig.damping,
      deadZoneX: camConfig.deadZoneX,
      deadZoneY: camConfig.deadZoneY,
      zoom: camConfig.zoom,
    });
    camera = createController(vcam);
    world.setResource('camera', camera);
  }

  // Update follow target reference
  camera.vcam.followTarget = pos;
  camera.vcam.damping = camConfig.damping;
  camera.vcam.zoom = camConfig.zoom;

  updateController(camera, dt);
}
