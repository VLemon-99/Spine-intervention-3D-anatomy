import { describe, expect, it } from 'vitest';
import { mount } from '../../src/render/index';

// Placeholder test: unit tests have no browser page, so this only checks the
// zone exports mount(element). The screen tests check what it shows.
describe('render zone', () => {
  it('exports a mount(element) function', () => {
    expect(typeof mount).toBe('function');
    expect(mount.length).toBe(1);
  });
});
