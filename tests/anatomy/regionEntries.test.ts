import { describe, expect, it } from 'vitest';
import { regionEntries } from '../../src/anatomy/regionWiring';

describe('regionEntries', () => {
  it('turns the manifest’s region names into { name, title } entries', () => {
    expect(regionEntries(['cervical', 'thoracic', 'lumbosacral'])).toEqual([
      { name: 'cervical', title: 'Cervical' },
      { name: 'thoracic', title: 'Thoracic' },
      { name: 'lumbosacral', title: 'Lumbosacral' },
    ]);
    expect(regionEntries(['lumbosacral'])).toEqual([{ name: 'lumbosacral', title: 'Lumbosacral' }]);
    expect(regionEntries([])).toEqual([]);
  });
});
