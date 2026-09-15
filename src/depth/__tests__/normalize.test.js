import { describe, expect, it } from 'vitest';
import { normalizeDepth } from '../normalize.js';

describe('normalizeDepth', () => {
  it('ближайшая точка модели даёт 1, дальняя — 0', () => {
    const out = normalizeDepth(Float32Array.from([2, 3, 4]));
    expect([...out]).toEqual([1, 0.5, 0]);
  });

  it('фон (0) остаётся ровно 0 и не участвует в диапазоне', () => {
    // Без исключения фона min был бы 0 и рельеф модели сжался бы вдвое.
    const out = normalizeDepth(Float32Array.from([0, 2, 0, 4]));
    expect([...out]).toEqual([0, 1, 0, 0]);
  });

  it('нормализует по диапазону модели, а не по near/far камеры', () => {
    // Модель занимает узкую полосу далеко от камеры: рельеф обязан
    // растянуться на весь [0, 1], иначе стереограмма выйдет плоской.
    const out = normalizeDepth(Float32Array.from([100, 100.5, 101]));
    expect([...out]).toEqual([1, 0.5, 0]);
  });

  it('плоская модель на одной глубине даёт 1, а не деление на ноль', () => {
    const out = normalizeDepth(Float32Array.from([0, 5, 5, 0]));
    expect([...out]).toEqual([0, 1, 1, 0]);
  });

  it('пустой кадр даёт полностью нулевую карту', () => {
    const out = normalizeDepth(new Float32Array(4));
    expect([...out]).toEqual([0, 0, 0, 0]);
  });

  it('сохраняет длину входа', () => {
    expect(normalizeDepth(new Float32Array(256 * 128)).length).toBe(256 * 128);
  });

  it('floor приподнимает модель над фоном, фон остаётся нулём', () => {
    // Дальняя точка модели уходит на floor, а не в 0 — у силуэта
    // появляется ступенька, и модель читается предметом перед фоном.
    const out = normalizeDepth(Float32Array.from([0, 2, 3, 4]), 0.5);
    expect([...out]).toEqual([0, 1, 0.75, 0.5]);
  });

  it('плоская модель с floor тоже даёт 1', () => {
    const out = normalizeDepth(Float32Array.from([0, 5, 5]), 0.4);
    expect([...out]).toEqual([0, 1, 1]);
  });
});
