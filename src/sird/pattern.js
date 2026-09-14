// Источники паттерна для генератора стереограммы.
// Контракт Pattern — docs/api_contracts.md, п.3.

// Целочисленный хэш (финализатор murmur3 fmix32) вместо последовательного
// PRNG: цвет зависит только от (seed, x, y), а не от порядка обхода
// пикселей, поэтому детерминизм не ломается при изменении порядка
// раскраски строки.
export function hash2d(seed, x, y) {
  let h = (seed | 0) ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Возвращает colorAt(x, y) → [r, g, b] для «свободных» пикселей
// (тех, на которые не ссылается ни одна пара same-ссылок).
export function createPatternSource(pattern, eyeSeparation) {
  if (pattern.type === 'noise') {
    const seed = (pattern.seed ?? Date.now()) | 0;
    if (pattern.color) {
      return (x, y) => {
        const h = hash2d(seed, x, y);
        return [h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff];
      };
    }
    return (x, y) => {
      const v = hash2d(seed, x, y) & 1 ? 255 : 0;
      return [v, v, v];
    };
  }

  if (pattern.type === 'image') {
    const { width, height, data } = pattern.data;
    // Полоса шириной E, тайлится по вертикали; если текстура уже E —
    // по обеим осям (docs/api_contracts.md, п.3). Масштабирование под E —
    // задача ui/, здесь только вырезание и тайлинг.
    const stripWidth = Math.min(width, eyeSeparation);
    return (x, y) => {
      const i = ((y % height) * width + (x % stripWidth)) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
  }

  throw new Error(`Неизвестный тип паттерна: ${pattern.type}`);
}
