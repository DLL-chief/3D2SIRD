import { describe, expect, it } from 'vitest';
import { generate } from '../generate.js';
import { patternPeriod } from '../pattern.js';

// Режимы паттерна-картинки: strip / drift / squeeze (docs/api_contracts.md,
// п.3). Проверяется на текстуре-градиенте, где в канале R лежит номер
// столбца, а в G — номер строки: по готовой картинке видно, какие именно
// пиксели текстуры попали в кадр.

const E = 64;
const MU = 0.45;
const SIZE = 256;
const TEXTURE_WIDTH = 200;
const TEXTURE_HEIGHT = 80;
// Период узора на фоне — round(E/2) = 32. Период E = 64 ему кратен,
// поэтому выполняется тоже (на нечётном E это было бы не так).
const PERIOD = patternPeriod(E);

function gradientTexture() {
  const data = new Uint8ClampedArray(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
  for (let y = 0; y < TEXTURE_HEIGHT; y++) {
    for (let x = 0; x < TEXTURE_WIDTH; x++) {
      const i = (y * TEXTURE_WIDTH + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 200;
      data[i + 3] = 255;
    }
  }
  return { width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT, data };
}

function flatBackground() {
  return { width: SIZE, height: SIZE, data: new Float32Array(SIZE * SIZE) };
}

function render(pattern) {
  return generate(flatBackground(), {
    eyeSeparation: E,
    depthStrength: MU,
    pattern: { type: 'image', data: gradientTexture(), ...pattern },
  });
}

// Номер исходного столбца (канал R) по строке готовой картинки.
function columns(image, y) {
  const out = [];
  for (let x = 0; x < image.width; x++) out.push(image.data[(y * image.width + x) * 4]);
  return out;
}

// Номер исходной строки (канал G) — по вертикали узор тоже тайлится.
function sourceRow(image, y) {
  return image.data[y * image.width * 4 + 1];
}

function maxStep(values) {
  let max = 0;
  for (let i = 1; i < values.length; i++) {
    max = Math.max(max, Math.abs(values[i] - values[i - 1]));
  }
  return max;
}

function bytes(image) {
  return Buffer.from(image.data.buffer);
}

describe('режимы паттерна-картинки', () => {
  it("'strip' без mirror: по горизонтали период ровно E", () => {
    const image = render({ mode: 'strip' });
    for (let y = 0; y < SIZE; y++) {
      const row = columns(image, y);
      for (let x = 0; x + E < SIZE; x++) expect(row[x]).toBe(row[x + E]);
    }
  });

  it('ни один режим не меняет период узора на фоне', () => {
    // Сепарация — дело generate.js: режим выборки на неё влиять не должен,
    // иначе сведение глаз зависело бы от выбранного узора.
    for (const mode of ['strip', 'drift', 'squeeze']) {
      for (const mirror of [false, true]) {
        const image = render({ mode, mirror, driftPerRow: 1 });
        const row = columns(image, 7);
        for (let x = 0; x + PERIOD < SIZE; x++) expect(row[x]).toBe(row[x + PERIOD]);
      }
    }
  });

  it('mirror убирает шов на стыке копий полосы', () => {
    const inside = (row) => maxStep(row.slice(0, PERIOD));
    const seam = (row) => Math.abs(row[PERIOD] - row[PERIOD - 1]);

    for (const mode of ['strip', 'drift', 'squeeze']) {
      const plain = columns(render({ mode, driftPerRow: 1 }), 0);
      const mirrored = columns(render({ mode, mirror: true, driftPerRow: 1 }), 0);
      // Без mirror на стыке скачок через всю ширину полосы — это и есть
      // видимый шов; проверка имеет смысл только потому, что его видно.
      expect(seam(plain)).toBeGreaterThan(inside(plain));
      // С mirror переход через стык не резче, чем внутри полосы.
      expect(seam(mirrored)).toBeLessThanOrEqual(inside(mirrored));
    }
  });

  it("'drift': полосы соседних строк различаются, но каждая периодична с E", () => {
    const image = render({ mode: 'drift', driftPerRow: 1 });
    const first = columns(image, 0);
    const second = columns(image, 1);
    expect(second).not.toEqual(first);

    for (let y = 0; y < SIZE; y++) {
      const row = columns(image, y);
      for (let x = 0; x + E < SIZE; x++) expect(row[x]).toBe(row[x + E]);
    }
  });

  it("'drift': за кадр расходуется вся ширина картинки", () => {
    // Смысл режима: в 'strip' в кадр попадает только полоса от левого
    // края, здесь начало полосы едет по картинке от строки к строке.
    const used = new Set();
    const image = render({ mode: 'drift', driftPerRow: 1 });
    for (let y = 0; y < SIZE; y++) for (const column of columns(image, y)) used.add(column);
    expect(used.size).toBe(TEXTURE_WIDTH);

    const strip = render({ mode: 'strip' });
    expect(new Set(columns(strip, 0)).size).toBe(PERIOD);
  });

  it("'squeeze': края полосы — это края исходной картинки", () => {
    const row = columns(render({ mode: 'squeeze' }), 0).slice(0, PERIOD);
    const step = Math.ceil(TEXTURE_WIDTH / PERIOD);

    expect(row[0]).toBe(0);
    expect(row[PERIOD - 1]).toBeGreaterThanOrEqual(TEXTURE_WIDTH - step);
    expect(row[PERIOD - 1]).toBeLessThanOrEqual(TEXTURE_WIDTH - 1);
    // Между краями столбцы идут по порядку — картинка проходится целиком.
    for (let x = 1; x < PERIOD; x++) expect(row[x]).toBeGreaterThan(row[x - 1]);
  });

  it('по вертикали узор отражается, а не повторяется', () => {
    // При повторе по модулю на строке height стоял бы скачок с последней
    // строки картинки на первую — в стереограмме это ложная ступенька.
    const image = render({ mode: 'strip' });
    expect(sourceRow(image, TEXTURE_HEIGHT - 1)).toBe(TEXTURE_HEIGHT - 1);
    expect(sourceRow(image, TEXTURE_HEIGHT)).toBe(TEXTURE_HEIGHT - 1);
    expect(sourceRow(image, TEXTURE_HEIGHT + 1)).toBe(TEXTURE_HEIGHT - 2);

    const rows = [];
    for (let y = 0; y < SIZE; y++) rows.push(sourceRow(image, y));
    expect(maxStep(rows)).toBe(1);
  });

  it('во всех режимах два вызова дают идентичный результат', () => {
    for (const mode of ['strip', 'drift', 'squeeze']) {
      for (const mirror of [false, true]) {
        const options = { mode, mirror, driftPerRow: 0.7 };
        expect(bytes(render(options))).toEqual(bytes(render(options)));
      }
    }
  });

  it('неизвестный режим — ошибка, а не молчаливая полоса', () => {
    expect(() => render({ mode: 'mosaic' })).toThrow(/Неизвестный режим/);
  });
});
