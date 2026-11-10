import { describe, expect, it } from 'vitest';
import { regionEntries } from '../../src/carm/regions';

describe('regionEntries (F3.7)', () => {
  it("for a build with only the phantom, the entries are exactly [{ name: 'phantom', title: 'Phantom' }]", () => {
    expect(regionEntries([], 'phantom')).toEqual([{ name: 'phantom', title: 'Phantom' }]);
  });

  it('lists nothing before any volume is loaded and no regions are on offer', () => {
    expect(regionEntries([], null)).toEqual([]);
  });

  it('does not list the loaded region twice', () => {
    const regions = [{ name: 'lumbosacral', title: 'Lumbosacral' }];
    expect(regionEntries(regions, 'lumbosacral')).toEqual(regions);
  });

  it('adds a loaded region that is not on offer after the listed ones', () => {
    const regions = [{ name: 'lumbosacral', title: 'Lumbosacral' }];
    expect(regionEntries(regions, 'phantom')).toEqual([...regions, { name: 'phantom', title: 'Phantom' }]);
  });

  it('returns copies, not the store entries', () => {
    const regions = [{ name: 'lumbosacral', title: 'Lumbosacral' }];
    expect(regionEntries(regions, null)[0]).not.toBe(regions[0]);
  });
});
