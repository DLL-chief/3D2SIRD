import { describe, expect, it } from 'vitest';
import { sliceGeometry } from '../texture.js';

// Полоса узора — одна на всю высоту кадра, поэтому масштаб задаётся
// высотой, а по ширине берётся срез. Раньше масштаб задавался шириной
// полосы, и от фотографии оставалась миниатюра, размноженная по вертикали.

const PHOTO = { width: 1600, height: 1200 };

describe('sliceGeometry', () => {
  it('масштабирует по высоте кадра, а не по ширине полосы', () => {
    const { width, height, drawWidth } = sliceGeometry(PHOTO, {
      frameHeight: 678,
      sampleWidth: 90,
    });
    expect(height).toBe(678);
    // 1600×1200 при высоте 678 — это 904 px ширины, из них берётся полоса.
    expect(drawWidth).toBe(904);
    expect(width).toBe(90);
  });

  it('берёт срез из середины картинки', () => {
    // На фотографии главное обычно в середине, а не у левого края.
    const { offsetX } = sliceGeometry(PHOTO, { frameHeight: 678, sampleWidth: 90 });
    expect(offsetX).toBe(Math.floor((904 - 90) / 2));
  });

  it("'drift' получает полосу плюс путь её начала за кадр", () => {
    const { width, offsetX } = sliceGeometry(PHOTO, {
      frameHeight: 678,
      sampleWidth: 90,
      mode: 'drift',
      driftPerRow: 0.7,
    });
    expect(width).toBe(Math.ceil(678 * 0.7) + 90);
    expect(offsetX).toBe(Math.floor((904 - width) / 2));
  });

  it("'drift' не просит больше, чем есть в картинке", () => {
    const { width, offsetX } = sliceGeometry(PHOTO, {
      frameHeight: 678,
      sampleWidth: 90,
      mode: 'drift',
      driftPerRow: 3,
    });
    expect(width).toBe(904);
    expect(offsetX).toBe(0);
  });

  it("'squeeze' сжимает всю картинку в ширину полосы", () => {
    const { width, height, drawWidth, offsetX } = sliceGeometry(PHOTO, {
      frameHeight: 678,
      sampleWidth: 90,
      mode: 'squeeze',
    });
    expect({ width, height, drawWidth, offsetX }).toEqual({
      width: 90,
      height: 678,
      drawWidth: 90,
      offsetX: 0,
    });
  });

  it('вытянутая по вертикали картинка не растягивается по ширине', () => {
    // Портрет 600×1600 при высоте 678 даёт 254 px ширины — это больше
    // полосы, срез берётся как обычно.
    const { width, drawWidth } = sliceGeometry(
      { width: 600, height: 1600 },
      { frameHeight: 678, sampleWidth: 90 },
    );
    expect(drawWidth).toBe(254);
    expect(width).toBe(90);
  });

  it('узкая картинка отдаётся как есть, без растягивания', () => {
    // 40×1600 при высоте 678 — это 17 px ширины: столбцов меньше, чем в
    // полосе, и придумывать их здесь нельзя. Генератор дотайлит полосу
    // отражением (docs/api_contracts.md, п.3).
    const { width, drawWidth } = sliceGeometry(
      { width: 40, height: 1600 },
      { frameHeight: 678, sampleWidth: 90 },
    );
    expect(drawWidth).toBe(17);
    expect(width).toBe(17);
  });

  it('не выдаёт нулевых размеров на вырожденных входах', () => {
    const { width, height } = sliceGeometry(
      { width: 4000, height: 20 },
      { frameHeight: 0.4, sampleWidth: 0.4, mode: 'squeeze' },
    );
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});
