import { describe, expect, it } from 'vitest';
import { depthToGrayscale, outputSize } from '../render.js';

describe('depthToGrayscale', () => {
  it('фон уходит в чёрный, ближняя точка — в белый', () => {
    const rgba = depthToGrayscale({
      width: 3,
      height: 1,
      data: Float32Array.from([0, 0.5, 1]),
    });
    expect([...rgba.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([128, 128, 128, 255]);
    expect([...rgba.slice(8, 12)]).toEqual([255, 255, 255, 255]);
  });

  it('канал прозрачности всегда непрозрачный', () => {
    const rgba = depthToGrayscale({ width: 4, height: 1, data: new Float32Array(4) });
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255);
  });

  it('длина буфера — четыре байта на пиксель', () => {
    const rgba = depthToGrayscale({
      width: 16,
      height: 9,
      data: new Float32Array(16 * 9),
    });
    expect(rgba.length).toBe(16 * 9 * 4);
  });
});

describe('outputSize', () => {
  it('режим «под ширину страницы» берёт доступную ширину', () => {
    expect(outputSize('fit', 968)).toEqual({ width: 968, height: 678 });
  });

  it('не уходит ниже 320 px на узком окне', () => {
    expect(outputSize('fit', 120).width).toBe(320);
  });

  it('фиксированное разрешение не зависит от окна', () => {
    expect(outputSize('1920', 500)).toEqual({ width: 1920, height: 1344 });
  });
});
