import { describe, expect, it } from 'vitest';
import { blurDepth } from '../blur.js';

describe('blurDepth', () => {
  it('радиус меньше единицы возвращает карту без изменений', () => {
    const data = Float32Array.from([0, 1, 0, 1]);
    expect(blurDepth(data, 2, 2, 0)).toBe(data);
  });

  it('сглаживает излом рельефа внутри модели', () => {
    // Ступенька 0.2 → 1 внутри модели (фона в строке нет): фильтр обязан
    // растянуть её в наклон, иначе на изломе стереограмма рвётся.
    const data = Float32Array.from([0.2, 0.2, 0.2, 1, 1, 1]);
    const out = blurDepth(data, 6, 1, 1);
    expect(out[2]).toBeGreaterThan(0.2);
    expect(out[3]).toBeLessThan(1);
    expect(out[2]).toBeLessThan(out[3]);
    const before = data.reduce((sum, v) => sum + v, 0);
    const after = out.reduce((sum, v) => sum + v, 0);
    expect(after).toBeCloseTo(before, 6);
  });

  it('не растворяет ступеньку силуэта в фоне', () => {
    // Модель на подъёме 0.5 рядом с фоном: фон обязан остаться ровно 0, а
    // модель — не просесть к нулю, иначе силуэт превращается в пологую
    // «юбку» и предмет читается холмом на стене.
    const data = Float32Array.from([0, 0, 0.5, 0.5, 0.5, 0]);
    const out = blurDepth(data, 6, 1, 1);
    expect([...out]).toEqual([0, 0, 0.5, 0.5, 0.5, 0]);
  });

  it('у края карты окно усекается, а не добивается нулями', () => {
    // Ровная карта из единиц должна остаться единицами и в углах —
    // иначе по периметру карты появилась бы тёмная кайма.
    const data = new Float32Array(16).fill(1);
    const out = blurDepth(data, 4, 4, 2);
    for (let i = 0; i < 16; i++) expect(out[i]).toBeCloseTo(1, 6);
  });

  it('одиночный пиксель модели в пустом кадре не размазывается', () => {
    // В окне нет других отсчётов модели, поэтому среднее равно самому
    // пикселю, а фон вокруг остаётся нулевым.
    const data = new Float32Array(9);
    data[4] = 0.5;
    const out = blurDepth(data, 3, 3, 1);
    expect([...out]).toEqual([0, 0, 0, 0, 0.5, 0, 0, 0, 0]);
  });

  it('не мутирует вход и сохраняет размеры', () => {
    const data = Float32Array.from([0.5, 1, 0.5, 1]);
    const out = blurDepth(data, 2, 2, 1);
    expect([...data]).toEqual([0.5, 1, 0.5, 1]);
    expect(out.length).toBe(4);
  });
});
