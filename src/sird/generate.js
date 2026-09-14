// Генератор автостереограммы по алгоритму Thimbleby, Inglis, Witten —
// «Displaying 3D Images: Algorithms for Single Image Random Dot
// Stereograms», IEEE Computer 27(10), 1994. Обозначения из статьи:
//   z  — глубина пикселя, 0 — фон/далеко, 1 — ближе всего к зрителю;
//   E  — межзрачковое расстояние в пикселях (eyeSeparation);
//   μ  — сила рельефа (depthStrength), 0 < μ < 1;
//   sep(z) = round(E·(1 − μz)/(2 − μz)) — стереосепарация: расстояние
//   между парой пикселей, которые оба глаза сводят в одну точку.
// Контракты входа/выхода — docs/api_contracts.md.

import { createPatternSource } from './pattern.js';

const DEFAULT_PARAMS = {
  eyeSeparation: 90,
  depthStrength: 1 / 3,
  crossEyed: false,
  pattern: { type: 'noise', color: false },
};

export function generate(depthMap, params = {}) {
  const { width, height, data: depth } = depthMap;
  if (depth.length !== width * height) {
    throw new Error(
      `Карта глубины не совпадает с размерами: ${depth.length} !== ${width}×${height}`,
    );
  }

  const { eyeSeparation: E, depthStrength: mu, crossEyed, pattern } = {
    ...DEFAULT_PARAMS,
    ...params,
  };
  const colorAt = createPatternSource(pattern, E);

  const out = new Uint8ClampedArray(width * height * 4);
  // same[x] — ссылка «пиксель x обязан быть того же цвета, что same[x]»,
  // всегда вправо (same[x] >= x); same[x] === x — пиксель свободен.
  const same = new Int32Array(width);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) same[x] = x;

    for (let x = 0; x < width; x++) {
      const z = crossEyed ? 1 - depth[row + x] : depth[row + x];
      const sep = Math.round((E * (1 - mu * z)) / (2 - mu * z));
      let left = x - (sep >> 1);
      let right = left + sep;
      if (left < 0 || right >= width) continue;

      // Проверка видимости точки обоими глазами (окклюзия): луч от глаза
      // к точке не должен пересекать более близкую поверхность. zt —
      // глубина луча на удалении t пикселей от x (формула из статьи);
      // выход за край карты считается фоном (z = 0), т.е. не заслоняет.
      let visible = true;
      let t = 1;
      let zt;
      do {
        zt = z + (2 * (2 - mu * z) * t) / (mu * E);
        const zl = x - t >= 0 ? depth[row + x - t] : 0;
        const zr = x + t < width ? depth[row + x + t] : 0;
        visible = zl < zt && zr < zt;
        t++;
      } while (visible && zt < 1);
      if (!visible) continue;

      // Связать left ≡ right, сохраняя цепочки same отсортированными
      // (перестановка ссылок из статьи: идём по цепочке, пока не найдём
      // место для right; уже записанные более близкие пары выигрывают).
      for (;;) {
        const l = same[left];
        if (l === left) {
          same[left] = right;
          break;
        }
        if (l === right) break;
        if (l < right) {
          left = l;
        } else {
          same[left] = right;
          left = right;
          right = l;
        }
      }
    }

    // Раскраска справа налево: same[x] всегда правее x, поэтому цвет
    // пары уже известен; свободный пиксель берёт цвет из паттерна.
    for (let x = width - 1; x >= 0; x--) {
      const i = (row + x) * 4;
      if (same[x] === x) {
        const [r, g, b] = colorAt(x, y);
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      } else {
        const j = (row + same[x]) * 4;
        out[i] = out[j];
        out[i + 1] = out[j + 1];
        out[i + 2] = out[j + 2];
      }
      out[i + 3] = 255;
    }
  }

  // В Node (vitest) нет глобального ImageData — возвращаем совместимый
  // объект с теми же полями, чтобы тесты не тянули DOM-окружение.
  return typeof ImageData !== 'undefined'
    ? new ImageData(out, width, height)
    : { width, height, data: out };
}
