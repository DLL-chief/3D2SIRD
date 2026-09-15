import { describe, expect, it } from 'vitest';
import { generate } from '../generate.js';
import { separationRange } from '../separation.js';

const E = 180;
const MU = 0.45;
const WIDTH = 600;
const HEIGHT = 4;

// Текстура, где каждый столбец помечен своим номером в канале R: по выходу
// видно, какие столбцы узора реально попали в кадр.
function numberedStrip(width) {
  const data = new Uint8ClampedArray(width * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x;
      data[i + 1] = 128;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  return { width, height: HEIGHT, data };
}

function flatBackground() {
  return { width: WIDTH, height: HEIGHT, data: new Float32Array(WIDTH * HEIGHT) };
}

function generateWith(strip) {
  return generate(flatBackground(), {
    eyeSeparation: E,
    depthStrength: MU,
    pattern: { type: 'image', data: strip },
  });
}

function columnsInFrame(image) {
  const used = new Set();
  for (let x = 0; x < image.width; x++) used.add(image.data[x * 4]);
  return used;
}

describe('generate с паттерном-картинкой', () => {
  const { far } = separationRange(E, MU);

  it('текстура шириной сепарации фона видна целиком', () => {
    expect(columnsInFrame(generateWith(numberedStrip(far))).size).toBe(far);
  });

  it('текстура шириной E показывается только наполовину', () => {
    // Период узора на фоне равен сепарации фона, то есть round(E/2):
    // полоса шириной E в кадр целиком не влезает. Поэтому масштабирование
    // в `ui/` идёт под сепарацию, а не под E.
    expect(columnsInFrame(generateWith(numberedStrip(E))).size).toBe(far);
  });

  it('на фоне узор повторяется с периодом сепарации фона', () => {
    const image = generateWith(numberedStrip(far));
    for (let x = 0; x + far < WIDTH; x++) {
      expect(image.data[x * 4]).toBe(image.data[(x + far) * 4]);
      expect(image.data[x * 4 + 2]).toBe(image.data[(x + far) * 4 + 2]);
    }
  });

  it('узкая текстура тайлится отражением, а не повтором', () => {
    // Текстура уже периода: внутри периода она укладывается несколько раз,
    // и стыки идут отражением (0..29, 29..0, 0..29). При повторе по модулю
    // на каждом стыке стоял бы скачок с последнего столбца на первый — в
    // стереограмме он читается ложной ступенькой глубины.
    const narrow = 30;
    const image = generateWith(numberedStrip(narrow));
    for (let x = 1; x < far; x++) {
      expect(Math.abs(image.data[x * 4] - image.data[(x - 1) * 4])).toBeLessThanOrEqual(1);
    }
  });

  it('цвета берутся из текстуры, а не из шума', () => {
    const image = generateWith(numberedStrip(far));
    // В текстуре зелёный всегда 128, синий 255 — в выходе не должно
    // появиться ничего другого.
    for (let i = 0; i < image.data.length; i += 4) {
      expect(image.data[i + 1]).toBe(128);
      expect(image.data[i + 2]).toBe(255);
      expect(image.data[i + 3]).toBe(255);
    }
  });

  it('детерминирован: два вызова дают одинаковые байты', () => {
    const first = generateWith(numberedStrip(far));
    const second = generateWith(numberedStrip(far));
    expect(Buffer.from(first.data.buffer)).toEqual(Buffer.from(second.data.buffer));
  });

  it('рельеф проступает: на карте с полусферой узор сдвигается', () => {
    const strip = numberedStrip(far);
    const flat = generateWith(strip);

    const data = new Float32Array(WIDTH * HEIGHT).fill(0);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 250; x < 350; x++) data[y * WIDTH + x] = 1;
    }
    const bump = generate(
      { width: WIDTH, height: HEIGHT, data },
      { eyeSeparation: E, depthStrength: MU, pattern: { type: 'image', data: strip } },
    );

    expect(Buffer.from(bump.data.buffer)).not.toEqual(Buffer.from(flat.data.buffer));
  });
});
