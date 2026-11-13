// Region loader (SPEC F1.6): reads the manifest and a region's files in the browser.
// Uses only browser built-ins (fetch, DecompressionStream). Does not touch the store;
// reacting to the region picker is done elsewhere.
import { createPhantom, createPhantomLandmarks } from '../core/phantom';
import type { Landmarks, RegionEntry, Volume } from '../core/types';
import { parseLandmarksFile, parseManifest, type ManifestRegion } from './manifestFormat';
import { parseRegionHeader, REGION_DATA_KINDS } from './regionFormat';

/** The part of fetch the loader needs (tests pass one that serves files from memory). */
export type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;

export interface LoaderOptions {
  /** Defaults to the browser's fetch. */
  fetch?: FetchLike;
  /** Folder holding manifest.json and the region files; defaults to 'data/' (public/data in the repo). */
  baseUrl?: string;
}

export interface LoadedRegion {
  volume: Volume;
  landmarks: Landmarks;
}

export const PHANTOM_REGION = 'phantom';
const MANIFEST_NAME = 'manifest.json';

function settings(options: LoaderOptions) {
  const doFetch: FetchLike = options.fetch ?? ((url) => fetch(url));
  const base = options.baseUrl ?? 'data/';
  return { doFetch, base: base.endsWith('/') ? base : `${base}/` };
}

async function fetchBytes(doFetch: FetchLike, url: string, what: string): Promise<Uint8Array> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await doFetch(url);
  } catch (e) {
    throw new Error(`Could not download ${what} (${url}): ${(e as Error).message}`, { cause: e });
  }
  if (!res.ok) throw new Error(`Could not download ${what} (${url}): the server answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchJson(doFetch: FetchLike, url: string, what: string): Promise<unknown> {
  const bytes = await fetchBytes(doFetch, url, what);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw new Error(`${what} (${url}) is not valid JSON`, { cause: e });
  }
}

/** Unpacks gzip only if the bytes really start with the gzip signature (some hosts unpack .gz files themselves). */
export async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readManifestRegions(options: LoaderOptions): Promise<ManifestRegion[]> {
  const { doFetch, base } = settings(options);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await doFetch(base + MANIFEST_NAME);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(await res.arrayBuffer()));
  } catch (e) {
    throw new Error(`${MANIFEST_NAME} is not valid JSON`, { cause: e });
  }
  return parseManifest(raw, MANIFEST_NAME).regions;
}

/** The regions the manifest offers ({ name, title }); an empty list if the manifest is missing or lists none. */
export async function listRegions(options: LoaderOptions = {}): Promise<RegionEntry[]> {
  return (await readManifestRegions(options)).map((r) => ({ name: r.name, title: r.title }));
}

/**
 * Loads one region: its header, intensity, label and level data, and landmarks.
 * 'phantom' returns the synthetic phantom without any download. Any other name
 * must be listed in the manifest; file names come only from the manifest.
 */
export async function loadRegion(name: string, options: LoaderOptions = {}): Promise<LoadedRegion> {
  if (name === PHANTOM_REGION) return { volume: createPhantom(), landmarks: createPhantomLandmarks() };
  const { doFetch, base } = settings(options);
  const entry = (await readManifestRegions(options)).find((r) => r.name === name);
  if (!entry) throw new Error(`Region ${JSON.stringify(name)} is not listed in ${MANIFEST_NAME}`);

  const header = parseRegionHeader(
    await fetchJson(doFetch, base + entry.files.header, `the header of region "${name}"`),
    `The header of region "${name}"`,
  );
  if (header.region !== name) throw new Error(`The header of region "${name}" names another region (${header.region})`);
  const { x, y, z } = header.size;
  if (x !== entry.size.x || y !== entry.size.y || z !== entry.size.z) {
    throw new Error(`Region "${name}": the header's size ${x}×${y}×${z} does not match the manifest`);
  }
  const voxels = x * y * z;

  const data = {} as Record<(typeof REGION_DATA_KINDS)[number], Uint8Array>;
  await Promise.all(
    REGION_DATA_KINDS.map(async (kind) => {
      const raw = await fetchBytes(doFetch, base + entry.files[kind], `the ${kind} data of region "${name}"`);
      const bytes = await gunzipIfNeeded(raw);
      if (bytes.length !== voxels) {
        throw new Error(`Region "${name}": the ${kind} data has ${bytes.length} bytes but ${x}×${y}×${z} = ${voxels} are needed`);
      }
      data[kind] = bytes;
    }),
  );

  const landmarksFile = parseLandmarksFile(
    await fetchJson(doFetch, base + entry.files.landmarks, `the landmarks of region "${name}"`),
    `The landmarks of region "${name}"`,
  );
  if (landmarksFile.region !== name) throw new Error(`The landmarks of region "${name}" name another region (${landmarksFile.region})`);
  const { reviewedByOwner: _reviewed, ...landmarks } = landmarksFile;
  void _reviewed;

  const volume: Volume = {
    region: name,
    size: { x, y, z },
    spacing: { ...header.spacing },
    origin: { ...header.origin },
    orientation: [{ ...header.orientation[0] }, { ...header.orientation[1] }, { ...header.orientation[2] }],
    intensity: data.intensity,
    labels: data.labels,
    levels: data.levels,
  };
  return { volume, landmarks };
}
