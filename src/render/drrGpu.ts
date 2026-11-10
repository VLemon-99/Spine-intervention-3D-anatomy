// GPU X-ray image (DRR) of the current volume (docs/SPEC.md F0.5, F0.6).
//
// The volume's intensity is uploaded as a 3D texture. A fragment shader runs
// once per image pixel: it builds that pixel's ray from the X-ray source to the
// detector with exactly the same maths as src/core/geometry.ts (same pose,
// same 512×512 grid, image row 0 at the top) and marches along it through the
// volume.
//
// Along each ray the absorption is added up from the intensity values
// (absorption per mm = intensity / 255 × ABSORPTION_PER_MM), and the pixel's
// brightness is e^(−total absorption): bone dark, soft tissue grey, air light.
// Noise, collimation, magnification, flips and the CPU reference come in F2.
//
// Assumes the volume's orientation is the identity (voxel i, j, k axes along
// patient x, y, z), which holds for the phantom; general orientations are F2.
import {
  Data3DTexture,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { IMAGE_SIZE_PX, createProjection } from '../core/geometry';
import type { CArmPose, Vec3, Volume } from '../core/types';

/** Ray-marching step along each ray, mm (half a phantom voxel). */
export const MARCH_STEP_MM = 0.5;
/**
 * Absorption per mm of a voxel with full intensity (255). Chosen so that about
 * 8 cm of soft tissue lets roughly half the X-rays through and bone shows
 * clearly darker. A display setting, not a physical constant; F2 may tune it.
 */
export const ABSORPTION_PER_MM = 0.025;

const vertexShader = /* glsl */ `
  void main() {
    // A 2×2 plane covers the whole viewport.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D uVolume;
  uniform vec3 uSource;
  uniform vec3 uDetectorCentre;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform float uPixelSize;
  uniform float uImageSize;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uStep;
  uniform float uAbsorptionPerMm;

  layout(location = 0) out highp vec4 outColor;

  void main() {
    // Pixel position in geometry.ts terms: x from the left, y from the TOP.
    float px = gl_FragCoord.x;
    float py = uImageSize - gl_FragCoord.y;
    float half_ = uImageSize * 0.5;
    vec3 onDetector = uDetectorCentre
      + uRight * (px - half_) * uPixelSize
      + uUp * (half_ - py) * uPixelSize;
    vec3 dir = normalize(onDetector - uSource);

    // Where the ray enters and leaves the volume's box (slab method).
    vec3 safeDir = vec3(
      abs(dir.x) < 1e-8 ? 1e-8 : dir.x,
      abs(dir.y) < 1e-8 ? 1e-8 : dir.y,
      abs(dir.z) < 1e-8 ? 1e-8 : dir.z);
    vec3 t0 = (uBoxMin - uSource) / safeDir;
    vec3 t1 = (uBoxMax - uSource) / safeDir;
    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);
    float tNear = max(max(tMin.x, tMin.y), max(tMin.z, 0.0));
    float tFar = min(min(tMax.x, tMax.y), tMax.z);

    // X-ray absorption law: add up absorption along the ray, then
    // brightness = e^(-total absorption). More absorption = darker.
    float total = 0.0;
    for (int i = 0; i < 4096; i++) {
      float t = tNear + (float(i) + 0.5) * uStep;
      if (t > tFar) break;
      vec3 uvw = (uSource + dir * t - uBoxMin) / (uBoxMax - uBoxMin);
      total += texture(uVolume, uvw).r * uAbsorptionPerMm * uStep;
    }
    float grey = exp(-total);
    outColor = vec4(vec3(grey), 1.0);
  }
`;

const toVector3 = (v: Vec3): Vector3 => new Vector3(v.x, v.y, v.z);

export interface DrrGpu {
  /** Draw the image of `volume` at `pose` into the renderer's canvas. */
  render(volume: Volume, pose: CArmPose): void;
}

export function createDrrGpu(renderer: WebGLRenderer): DrrGpu {
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader,
    uniforms: {
      uVolume: { value: null },
      uSource: { value: new Vector3() },
      uDetectorCentre: { value: new Vector3() },
      uRight: { value: new Vector3() },
      uUp: { value: new Vector3() },
      uPixelSize: { value: 1 },
      uImageSize: { value: IMAGE_SIZE_PX },
      uBoxMin: { value: new Vector3() },
      uBoxMax: { value: new Vector3() },
      uStep: { value: MARCH_STEP_MM },
      uAbsorptionPerMm: { value: ABSORPTION_PER_MM },
    },
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let uploaded: { volume: Volume; texture: Data3DTexture } | null = null;

  const textureFor = (volume: Volume): Data3DTexture => {
    if (uploaded?.volume === volume) return uploaded.texture;
    uploaded?.texture.dispose();
    const texture = new Data3DTexture(volume.intensity, volume.size.x, volume.size.y, volume.size.z);
    texture.format = RedFormat;
    texture.type = UnsignedByteType;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.unpackAlignment = 1; // rows of 95 bytes are not 4-byte aligned
    texture.needsUpdate = true;
    uploaded = { volume, texture };
    return texture;
  };

  return {
    render(volume, pose) {
      const projection = createProjection(pose);
      const { origin, spacing, size } = volume;
      const u = material.uniforms;
      u.uVolume!.value = textureFor(volume);
      u.uSource!.value = toVector3(projection.source);
      u.uDetectorCentre!.value = toVector3(projection.detectorCentre);
      u.uRight!.value = toVector3(projection.detectorRight);
      u.uUp!.value = toVector3(projection.detectorUp);
      u.uPixelSize!.value = projection.pixelSizeMm;
      u.uImageSize!.value = projection.width;
      // The box spans from the outer face of the first voxel to that of the last.
      u.uBoxMin!.value = new Vector3(origin.x - spacing.x / 2, origin.y - spacing.y / 2, origin.z - spacing.z / 2);
      u.uBoxMax!.value = new Vector3(
        origin.x + (size.x - 0.5) * spacing.x,
        origin.y + (size.y - 0.5) * spacing.y,
        origin.z + (size.z - 0.5) * spacing.z,
      );
      renderer.render(scene, camera);
    },
  };
}
