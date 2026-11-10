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
// The image is drawn in two steps, following the ORDER OF STEPS at the top of
// pipeline.ts: take() renders the X-ray image into an off-screen image that is
// kept (the held image); display() draws the held image to the canvas, with
// the display settings (invert, flips, rotation). display() can run again at any time without
// a new exposure.
//
// The numbers shared with the CPU reference (drrCpu.ts) live in pipeline.ts.
// Noise, collimation, magnification and flips come in later F2 stories.
//
// Assumes the volume's orientation is the identity (voxel i, j, k axes along
// patient x, y, z), which holds for the phantom; general orientations are F2.
import {
  Data3DTexture,
  GLSL3,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { IMAGE_SIZE_PX, createProjection } from '../core/geometry';
import type { CArmPose, Vec3, Volume } from '../core/types';
import { ROTATIONS, type Orientation } from './orientation';
import {
  ABSORPTION_PER_MM,
  MARCH_STEP_MM,
  MAX_MARCH_STEPS,
  NO_SIGNAL,
  type Collimation,
  type Magnification,
} from './pipeline';

export { ABSORPTION_PER_MM, MARCH_STEP_MM };

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
  uniform float uMagnification;
  // Shutter widths in pixels, from each edge: left, right, top, bottom.
  uniform vec4 uShutterPx;
  uniform float uNoSignal;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uStep;
  uniform float uAbsorptionPerMm;

  layout(location = 0) out highp vec4 outColor;

  void main() {
    // Pixel position in geometry.ts terms: x from the left, y from the TOP.
    float px = gl_FragCoord.x;
    float py = uImageSize - gl_FragCoord.y;
    // Step 4, collimation (decided first, so covered pixels are not marched):
    // a pixel is covered when its whole-pixel distance from an edge is less
    // than that shutter's width. Covered pixels get the fixed no-signal value.
    float column = floor(px);
    float row = floor(py);
    float last = uImageSize - 1.0;
    if (column < uShutterPx.x || last - column < uShutterPx.y || row < uShutterPx.z || last - row < uShutterPx.w) {
      outColor = vec4(vec3(uNoSignal), 1.0);
      return;
    }
    float half_ = uImageSize * 0.5;
    // Step 1, magnification: the pixel looks at centre + (p - centre) / m.
    px = half_ + (px - half_) / uMagnification;
    py = half_ + (py - half_) / uMagnification;
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
    for (int i = 0; i < ${MAX_MARCH_STEPS}; i++) {
      float t = tNear + (float(i) + 0.5) * uStep;
      if (t > tFar) break;
      vec3 uvw = (uSource + dir * t - uBoxMin) / (uBoxMax - uBoxMin);
      total += texture(uVolume, uvw).r * uAbsorptionPerMm * uStep;
    }
    float grey = exp(-total);
    outColor = vec4(vec3(grey), 1.0);
  }
`;

/**
 * Display step: draws the held image to the canvas with the display settings
 * (steps 5 and 6 of pipeline.ts). For each canvas pixel it works out which
 * pixel of the image as taken is shown there — unorientPixel() in
 * orientation.ts, written out in GLSL — and reads exactly that pixel.
 */
const displayFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uHeld;
  uniform float uImageSize;
  uniform bool uInvert;
  uniform bool uFlipHorizontal;
  uniform bool uFlipVertical;
  // Number of 90° clockwise turns (0–3).
  uniform int uQuarterTurns;

  layout(location = 0) out highp vec4 outColor;

  void main() {
    float last = uImageSize - 1.0;
    // Canvas pixel, counted from the top-left like the image.
    float x = floor(gl_FragCoord.x);
    float y = last - floor(gl_FragCoord.y);

    // Step 6 backwards: undo the rotation, then the up-down flip, then the left-right flip.
    for (int n = 0; n < uQuarterTurns; n++) {
      float turnedX = y;
      y = last - x;
      x = turnedX;
    }
    if (uFlipVertical) y = last - y;
    if (uFlipHorizontal) x = last - x;

    // The held image is stored bottom row first.
    float value = texelFetch(uHeld, ivec2(int(x), int(last - y)), 0).r;
    // Step 5, invert: value -> 1 - value.
    if (uInvert) value = 1.0 - value;
    outColor = vec4(vec3(value), 1.0);
  }
`;

const toVector3 = (v: Vec3): Vector3 => new Vector3(v.x, v.y, v.z);

/** The settings that belong to taking the image. */
export interface TakeOptions {
  magnification: Magnification;
  collimation: Collimation;
}

/** The display settings the display step uses. */
export interface DisplayOptions extends Orientation {
  invert: boolean;
}

export interface DrrGpu {
  /** Take the image of `volume` at `pose` into the held (off-screen) image. Does not touch the canvas. */
  take(volume: Volume, pose: CArmPose, options: TakeOptions): void;
  /** Draw the held image into the renderer's canvas. Cheap; needs no new exposure. */
  display(options: DisplayOptions): void;
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
      uMagnification: { value: 1 },
      uShutterPx: { value: new Vector4() },
      uNoSignal: { value: NO_SIGNAL },
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

  // The held image: 8 bits per channel, read back pixel for pixel.
  const held = new WebGLRenderTarget(IMAGE_SIZE_PX, IMAGE_SIZE_PX, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
    colorSpace: NoColorSpace,
  });
  const displayMaterial = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader: displayFragmentShader,
    uniforms: {
      uHeld: { value: held.texture },
      uImageSize: { value: IMAGE_SIZE_PX },
      uInvert: { value: false },
      uFlipHorizontal: { value: false },
      uFlipVertical: { value: false },
      uQuarterTurns: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const displayScene = new Scene();
  displayScene.add(new Mesh(new PlaneGeometry(2, 2), displayMaterial));
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
    take(volume, pose, options) {
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
      u.uMagnification!.value = options.magnification;
      // The same sum as isCollimated() in pipeline.ts: percent / 100 × image size.
      const shutterPx = (percent: number): number => (percent / 100) * projection.width;
      const { left, right, top, bottom } = options.collimation;
      u.uShutterPx!.value = new Vector4(shutterPx(left), shutterPx(right), shutterPx(top), shutterPx(bottom));
      // The box spans from the outer face of the first voxel to that of the last.
      u.uBoxMin!.value = new Vector3(origin.x - spacing.x / 2, origin.y - spacing.y / 2, origin.z - spacing.z / 2);
      u.uBoxMax!.value = new Vector3(
        origin.x + (size.x - 0.5) * spacing.x,
        origin.y + (size.y - 0.5) * spacing.y,
        origin.z + (size.z - 0.5) * spacing.z,
      );
      renderer.setRenderTarget(held);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    },
    display(options) {
      const d = displayMaterial.uniforms;
      d.uInvert!.value = options.invert;
      d.uFlipHorizontal!.value = options.flipHorizontal;
      d.uFlipVertical!.value = options.flipVertical;
      d.uQuarterTurns!.value = Math.max(0, ROTATIONS.indexOf(options.rotation));
      renderer.setRenderTarget(null);
      renderer.render(displayScene, camera);
    },
  };
}
