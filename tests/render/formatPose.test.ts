import { describe, expect, it } from 'vitest';
import type { CArmPose } from '../../src/core/types';
import { formatPose } from '../../src/render/formatPose';

const pose = (oblique: number, tilt: number, table: Partial<CArmPose> = {}): CArmPose => ({
  oblique,
  tilt,
  tableLeftRight: 0,
  tableHeadFoot: 0,
  tableHeight: 0,
  ...table,
});

describe('formatPose', () => {
  it('names right oblique and cranial tilt for positive angles', () => {
    expect(formatPose(pose(25, 10))).toBe('OBL R 25° · CRAN 10°');
  });

  it('names left oblique and caudal tilt for negative angles', () => {
    expect(formatPose(pose(-30, -15))).toBe('OBL L 30° · CAUD 15°');
  });

  it("gives 'AP · TILT 0°' for a straight beam", () => {
    expect(formatPose(pose(0, 0))).toBe('AP · TILT 0°');
  });

  it('mixes the two angles freely', () => {
    expect(formatPose(pose(0, -20))).toBe('AP · CAUD 20°');
    expect(formatPose(pose(-90, 0))).toBe('OBL L 90° · TILT 0°');
    expect(formatPose(pose(45, -40))).toBe('OBL R 45° · CAUD 40°');
  });

  it('rounds angles to whole degrees', () => {
    expect(formatPose(pose(24.6, 9.5))).toBe('OBL R 25° · CRAN 10°');
    expect(formatPose(pose(-24.6, -9.6))).toBe('OBL L 25° · CAUD 10°');
    expect(formatPose(pose(24.4, 10.4))).toBe('OBL R 24° · CRAN 10°');
  });

  it('an angle that rounds to 0 reads as 0 (no "OBL R 0°" and no minus sign)', () => {
    expect(formatPose(pose(0.4, -0.4))).toBe('AP · TILT 0°');
    expect(formatPose(pose(-0.3, 0.2))).toBe('AP · TILT 0°');
  });

  it('shows only the two angles, not the table position', () => {
    expect(formatPose(pose(25, 10, { tableLeftRight: 30, tableHeadFoot: -20, tableHeight: 15 }))).toBe(
      'OBL R 25° · CRAN 10°',
    );
  });
});
