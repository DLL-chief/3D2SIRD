import { describe, expect, it } from 'vitest';
import { separation, separationRange } from '../separation.js';

describe('separation', () => {
  it('на фоне даёт половину межзрачкового расстояния', () => {
    // z = 0 — самая далёкая точка: пара расходится на E/2.
    expect(separation(0, 180, 0.45)).toBe(90);
    expect(separation(0, 90, 1 / 3)).toBe(45);
  });

  it('с приближением точки к зрителю сепарация уменьшается', () => {
    const far = separation(0, 180, 0.45);
    const middle = separation(0.5, 180, 0.45);
    const near = separation(1, 180, 0.45);
    expect(middle).toBeLessThan(far);
    expect(near).toBeLessThan(middle);
  });

  it('возвращает целое число пикселей', () => {
    for (const z of [0.1, 0.33, 0.77, 0.9]) {
      expect(Number.isInteger(separation(z, 137, 0.37))).toBe(true);
    }
  });
});

describe('separationRange', () => {
  it('считает число ступеней рельефа для дефолтов контракта', () => {
    expect(separationRange(180, 0.45)).toEqual({ near: 64, far: 90, levels: 27 });
  });

  it('показывает, почему прежние дефолты давали террасы', () => {
    // 10 ступеней на весь рельеф: гладкая сфера читалась вытянутым холмом.
    expect(separationRange(90, 1 / 3)).toEqual({ near: 36, far: 45, levels: 10 });
  });

  it('число ступеней растёт и от E, и от μ', () => {
    const base = separationRange(180, 0.45).levels;
    expect(separationRange(300, 0.45).levels).toBeGreaterThan(base);
    expect(separationRange(180, 0.7).levels).toBeGreaterThan(base);
  });
});
