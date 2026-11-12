import { describe, expect, it } from 'vitest';
import { loadCredits, parseCredits } from '../../src/app/about';

// Made-up manifests only.
describe('About page credits', () => {
  it('reads sourceDataset, licence and attribution per region', () => {
    expect(
      parseCredits({
        regions: [{ name: 'a', sourceDataset: 'Example A', licence: 'CC BY 4.0', attribution: 'Lab A' }],
      }),
    ).toEqual([{ sourceDataset: 'Example A', licence: 'CC BY 4.0', attribution: 'Lab A' }]);
  });

  it('leaves out regions whose fields are not text, and gives [] for anything that is not a manifest', () => {
    expect(
      parseCredits({
        regions: [
          { sourceDataset: 1, licence: 'x', attribution: 'y' },
          { sourceDataset: 'x', licence: 'y' },
          null,
          'text',
          { sourceDataset: 'Ok', licence: 'L', attribution: 'A' },
        ],
      }),
    ).toEqual([{ sourceDataset: 'Ok', licence: 'L', attribution: 'A' }]);
    for (const bad of [null, 'text', 42, [], {}, { regions: 'no' }]) expect(parseCredits(bad)).toEqual([]);
  });

  it('loadCredits gives [] for a failed response, a failed fetch or bad JSON, without throwing', async () => {
    const notFound = (async () => new Response('missing', { status: 404 })) as typeof fetch;
    const broken = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const badJson = (async () => new Response('{nope', { status: 200 })) as typeof fetch;
    for (const fetchFn of [notFound, broken, badJson]) {
      await expect(loadCredits(fetchFn, '/data/manifest.json')).resolves.toEqual([]);
    }
    const ok = (async () =>
      new Response(JSON.stringify({ regions: [{ sourceDataset: 'D', licence: 'L', attribution: 'A' }] }))) as typeof fetch;
    await expect(loadCredits(ok, '/data/manifest.json')).resolves.toEqual([
      { sourceDataset: 'D', licence: 'L', attribution: 'A' },
    ]);
  });
});
