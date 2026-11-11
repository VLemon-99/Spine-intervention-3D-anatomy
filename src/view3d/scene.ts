// The Three.js scene of the 3D view (F8.1): the bone surface, lights and the
// camera. No DOM here; index.ts owns the canvas, the renderer and the panel.

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { TISSUE } from '../core/labels';
import type { Volume } from '../core/types';
import { buildSurface } from './surface';

/** Background colour of the 3D canvas. */
export const BACKGROUND = 0x0b1016;

/** Labels drawn as the always-shown bone surface. */
export const BONE_LABELS: readonly number[] = [TISSUE.corticalBone, TISSUE.cancellousBone];

const FOV_DEG = 40;
/** Direction from the target to the start camera: behind the patient's back, a little to the left and toward the head. */
const START_DIRECTION = new Vector3(0.5, 1, 0.35).normalize();

export interface View3dScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** The point the camera looks at (orbit centre). */
  target: Vector3;
  /** The bone surface mesh (named 'bone'). */
  bone: Mesh<BufferGeometry, MeshLambertMaterial>;
  /** Rebuild the anatomy objects for a volume (or empty them for null) and reset the camera to show it. */
  setVolume(volume: Volume | null): void;
  /** Set the camera's aspect ratio (width / height). */
  setAspect(aspect: number): void;
}

/** Number of triangles drawn by a (non-indexed) geometry. */
export function triangleCount(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

function meshGeometry(volume: Volume | null, labels: readonly number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  const mesh = volume ? buildSurface(volume, labels) : { positions: new Float32Array(0), normals: new Float32Array(0) };
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createView3dScene(): View3dScene {
  const scene = new Scene();
  scene.background = new Color(BACKGROUND);

  const camera = new PerspectiveCamera(FOV_DEG, 1, 1, 5000);
  camera.up.set(0, 0, 1); // the patient's head is up on screen
  const target = new Vector3();

  scene.add(new AmbientLight(0xffffff, 0.45));
  // A light at the camera, so the side the learner looks at is always lit.
  const headLight = new DirectionalLight(0xffffff, 1.4);
  headLight.position.set(0.3, 0.4, 1);
  camera.add(headLight);
  scene.add(camera);

  const bone = new Mesh(meshGeometry(null, BONE_LABELS), new MeshLambertMaterial({ color: 0xe8dfc8 }));
  bone.name = 'bone';
  scene.add(bone);

  const fitCamera = (volume: Volume | null): void => {
    let radius = 100;
    target.set(0, 0, 0);
    if (volume) {
      const { origin, spacing, size } = volume;
      const min = new Vector3(origin.x - spacing.x / 2, origin.y - spacing.y / 2, origin.z - spacing.z / 2);
      const max = new Vector3(
        min.x + size.x * spacing.x,
        min.y + size.y * spacing.y,
        min.z + size.z * spacing.z,
      );
      target.addVectors(min, max).multiplyScalar(0.5);
      radius = Math.max(1, min.distanceTo(max) / 2);
    }
    const halfFov = (Math.min(FOV_DEG, FOV_DEG * Math.min(1, camera.aspect)) * Math.PI) / 360;
    const distance = (radius / Math.sin(halfFov)) * 1.05;
    camera.position.copy(target).addScaledVector(START_DIRECTION, distance);
    camera.near = Math.max(0.1, distance / 100);
    camera.far = distance * 10;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };

  return {
    scene,
    camera,
    target,
    bone,
    setVolume(volume) {
      const old = bone.geometry;
      bone.geometry = meshGeometry(volume, BONE_LABELS);
      old.dispose();
      fitCamera(volume);
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}
