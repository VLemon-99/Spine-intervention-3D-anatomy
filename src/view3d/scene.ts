// The Three.js scene of the 3D view (F8.1): the bone surface, lights and the
// camera. No DOM here; index.ts owns the canvas, the renderer and the panel.

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { CArmPose, NeedleState, Volume } from '../core/types';
import { carmModel } from './carmModel';
import { BONE_LABELS, LAYERS, layerObjectName, type LayerId } from './layers';
import { buildSurface } from './surface';

/** Background colour of the 3D canvas. */
export const BACKGROUND = 0x0b1016;


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
  /** One surface per layer (named 'layer-<id>'), in LAYERS order. */
  layers: Map<LayerId, Mesh<BufferGeometry, MeshLambertMaterial>>;
  /** The needle shaft, hub to tip, as a line (named 'needle'); hidden when there is no needle. */
  needle: Line<BufferGeometry, LineBasicMaterial>;
  /** The X-ray source (named 'source'): a small sphere at mesh.position. */
  source: Mesh<SphereGeometry, MeshLambertMaterial>;
  /** The detector (named 'detector'): a flat square whose four vertices are its corners, in patient coordinates. */
  detector: Mesh<BufferGeometry, MeshLambertMaterial>;
  /** The beam outline (named 'beam'): lines from the source to the four detector corners. */
  beam: LineSegments<BufferGeometry, LineBasicMaterial>;
  /** Move the C-arm objects to a pose. */
  setPose(pose: CArmPose): void;
  /** Rebuild the needle line from the needle state (null hides it). */
  setNeedle(needle: NeedleState | null): void;
  /** Rebuild the anatomy objects for a volume (or empty them for null) and reset the camera to show it. */
  setVolume(volume: Volume | null): void;
  /** Set the camera's aspect ratio (width / height). */
  setAspect(aspect: number): void;
}

/** Number of triangles drawn by a geometry (indexed or not). */
export function triangleCount(geometry: BufferGeometry): number {
  if (geometry.index) return Math.floor(geometry.index.count / 3);
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

  const layers = new Map<LayerId, Mesh<BufferGeometry, MeshLambertMaterial>>();
  for (const layer of LAYERS) {
    const seeThrough = layer.opacity < 1;
    const material = new MeshLambertMaterial({
      color: layer.colour,
      transparent: seeThrough,
      opacity: layer.opacity,
      // A see-through layer must not hide what lies behind it.
      depthWrite: !seeThrough,
    });
    const mesh = new Mesh(meshGeometry(null, layer.labels), material);
    mesh.name = layerObjectName(layer.id);
    mesh.visible = layer.startVisible;
    layers.set(layer.id, mesh);
    scene.add(mesh);
  }

  const needle = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0x7fd8ff }));
  needle.name = 'needle';
  needle.visible = false;
  // Draw the needle over the bone, so it is never lost inside it.
  needle.material.depthTest = false;
  needle.renderOrder = 1;
  scene.add(needle);

  // The C-arm: source sphere, detector square (corners as vertices) and beam lines.
  const source = new Mesh(new SphereGeometry(12, 16, 12), new MeshLambertMaterial({ color: 0xffb347 }));
  source.name = 'source';
  scene.add(source);

  const detectorGeometry = new BufferGeometry();
  detectorGeometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  detectorGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const detector = new Mesh(
    detectorGeometry,
    new MeshLambertMaterial({ color: 0x8fa3b8, side: DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  detector.name = 'detector';
  scene.add(detector);

  const beamGeometry = new BufferGeometry();
  beamGeometry.setAttribute('position', new BufferAttribute(new Float32Array(24), 3));
  const beam = new LineSegments(beamGeometry, new LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.6 }));
  beam.name = 'beam';
  scene.add(beam);

  const setPose = (pose: CArmPose): void => {
    const model = carmModel(pose);
    source.position.set(model.source.x, model.source.y, model.source.z);
    const corners = detectorGeometry.getAttribute('position') as BufferAttribute;
    const lines = beamGeometry.getAttribute('position') as BufferAttribute;
    model.detectorCorners.forEach((c, i) => {
      corners.setXYZ(i, c.x, c.y, c.z);
      lines.setXYZ(2 * i, model.source.x, model.source.y, model.source.z);
      lines.setXYZ(2 * i + 1, c.x, c.y, c.z);
    });
    corners.needsUpdate = true;
    lines.needsUpdate = true;
    detectorGeometry.computeVertexNormals();
    detectorGeometry.computeBoundingSphere();
    beamGeometry.computeBoundingSphere();
  };
  setPose({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });

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
    // Also take in the whole C-arm, source to detector, at its current pose.
    radius = Math.max(radius, source.position.distanceTo(target) + 12);
    const corners = detectorGeometry.getAttribute('position');
    const corner = new Vector3();
    for (let i = 0; i < corners.count; i++) {
      corner.fromBufferAttribute(corners, i);
      radius = Math.max(radius, corner.distanceTo(target));
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
    layers,
    needle,
    source,
    detector,
    beam,
    setPose,
    setVolume(volume) {
      const old = bone.geometry;
      bone.geometry = meshGeometry(volume, BONE_LABELS);
      old.dispose();
      for (const layer of LAYERS) {
        const mesh = layers.get(layer.id)!;
        const previous = mesh.geometry;
        mesh.geometry = meshGeometry(volume, layer.labels);
        previous.dispose();
      }
      fitCamera(volume);
    },
    setNeedle(state) {
      const old = needle.geometry;
      const geometry = new BufferGeometry();
      const points = state?.shaft ?? [];
      const positions = new Float32Array(points.length * 3);
      points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      needle.geometry = geometry;
      old.dispose();
      needle.visible = points.length >= 2;
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}
