import { describe, expect, it } from 'vitest';
import { blurDepth } from '../blur.js';

describe('blurDepth', () => {
  it('радиус меньше единицы возвращает карту без изменений', () => {
    const data = Float32Array.from([0, 1, 0, 1]);
    expect(blurDepth(data, 2, 2, 0)).toBe(data);
  });

  it('одиночный пик размазывается по окну 3×3 с радиусом 1', () => {
    // Пик 9 в центре карты 3×3. В центре получается ровно 9/9 = 1, а по
    // краям больше: там окно усечено границей карты и среднее берётся по
    // 2 отсчётам вместо 3. Это плата за то, что ровная карта остаётся
    // ровной (см. тест про усечение окна ниже).
    const data = new Float32Array(9);
    data[4] = 9;
    const out = blurDepth(data, 3, 3, 1);
    expect([...out]).toEqual([2.25, 1.5, 2.25, 1.5, 1, 1.5, 2.25, 1.5, 2.25]);
  });

  it('у края окно усекается, а не добивается нулями', () => {
    // Ровная карта из единиц должна остаться единицами и в углах —
    // иначе по периметру карты появилась бы тёмная кайма.
    const data = new Float32Array(16).fill(1);
    const out = blurDepth(data, 4, 4, 2);
    for (let i = 0; i < 16; i++) expect(out[i]).toBeCloseTo(1, 6);
  });

  it('сглаживает ступеньку глубины, сохраняя средний уровень', () => {
    const width = 6;
    const data = Float32Array.from([0, 0, 0, 1, 1, 1]);
    const out = blurDepth(data, width, 1, 1);
    expect(out[2]).toBeGreaterThan(0);
    expect(out[3]).toBeLessThan(1);
    expect(out[2]).toBeLessThan(out[3]);
    const before = data.reduce((sum, v) => sum + v, 0);
    const after = out.reduce((sum, v) => sum + v, 0);
    expect(after).toBeCloseTo(before, 6);
  });

  it('не мутирует вход и сохраняет размеры', () => {
    const data = Float32Array.from([0, 1, 0, 1]);
    const out = blurDepth(data, 2, 2, 1);
    expect([...data]).toEqual([0, 1, 0, 1]);
    expect(out.length).toBe(4);
  });
});
