import { describe, expect, it } from 'vitest';
import { canUseWebgl2, type CanvasLike } from '../../src/app/webgl2';

const factory = (getContext: (id: string) => unknown) => (): CanvasLike => ({ getContext });

describe('WebGL2 check', () => {
  it("returns false when getContext('webgl2') returns null", () => {
    expect(canUseWebgl2(factory(() => null))).toBe(false);
  });

  it("returns false when getContext('webgl2') throws", () => {
    expect(
      canUseWebgl2(
        factory(() => {
          throw new Error('no GPU');
        }),
      ),
    ).toBe(false);
  });

  it('returns false when making the canvas throws', () => {
    expect(
      canUseWebgl2(() => {
        throw new Error('no canvas');
      }),
    ).toBe(false);
  });

  it("returns true when getContext('webgl2') returns an object, and asks for 'webgl2'", () => {
    const asked: string[] = [];
    expect(
      canUseWebgl2(
        factory((id) => {
          asked.push(id);
          return id === 'webgl2' ? {} : null;
        }),
      ),
    ).toBe(true);
    expect(asked).toEqual(['webgl2']);
  });
});
