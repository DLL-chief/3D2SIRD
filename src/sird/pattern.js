// Источники паттерна для генератора стереограммы.
// Контракт Pattern — docs/api_contracts.md, п.3.

const DEFAULT_DRIFT_PER_ROW = 0.7;

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

// Период узора на фоне. Сепарация при z = 0 равна round(E/2) при любом μ
// (μ входит в формулу только вместе с z), поэтому именно с этим шагом
// повторяются точки фона — и ровно столько столбцов картинки видно в
// кадре. Отсюда и ширина полосы: брать E вдвое шире незачем, вторая
// половина в кадр не попадает (docs/api_contracts.md, п.3).
export function patternPeriod(eyeSeparation) {
  return Math.max(1, Math.round(eyeSeparation / 2));
}

// Отражение вместо повтора по модулю. При повторе на каждом стыке копий
// стоит скачок цвета от последнего столбца/строки картинки к первому: в
// стереограмме такой скачок читается ложной ступенькой глубины. Отражение
// (ping-pong) делает переход непрерывным.
function pingPong(value, size) {
  if (size <= 1) return 0;
  const span = 2 * size;
  let folded = value % span;
  if (folded < 0) folded += span;
  return folded >= size ? span - 1 - folded : folded;
}

function createImageSource(pattern, eyeSeparation) {
  const { width, height, data } = pattern.data;
  const mode = pattern.mode ?? 'strip';
  const mirror = pattern.mirror ?? false;
  const driftPerRow = pattern.driftPerRow ?? DEFAULT_DRIFT_PER_ROW;

  // Период выборки задаётся сепарацией фона: ни один режим её не меняет,
  // она считается в generate.js по формуле из separation.js.
  const period = patternPeriod(eyeSeparation);
  // При mirror полоса склеена из половины и её отражения, поэтому исходных
  // столбцов нужно вдвое меньше.
  const sampleWidth = mirror ? Math.ceil(period / 2) : period;

  // x внутри периода, с отражением второй половины при mirror. Тогда у
  // соседних копий полосы на стыке совпадают крайние столбцы, и разрыва
  // нет ни на стыке, ни в середине.
  const stripIndex = (x) => {
    const inPeriod = ((x % period) + period) % period;
    return mirror && inPeriod >= sampleWidth ? period - 1 - inPeriod : inPeriod;
  };

  const columnFor = {
    // Полоса от левого края картинки.
    strip: (index) => pingPong(index, width),
    // Своя полоса на каждую строку: начало едет по картинке, поэтому
    // повторение перестаёт читаться обоями, а картинка расходуется по всей
    // ширине. Отражением, а не по модулю — иначе на краю картинки был бы
    // вертикальный разрыв.
    drift: (index, y) => pingPong(Math.round(y * driftPerRow) + index, width),
    // Вся картинка сжата по горизонтали до ширины полосы. Выборка
    // ближайшим соседом: билинейная мылит зерно, а высокие частоты нужны
    // для читаемости стерео.
    squeeze: (index) =>
      Math.min(width - 1, Math.floor((index / sampleWidth) * width)),
  }[mode];

  if (!columnFor) throw new Error(`Неизвестный режим паттерна: ${mode}`);

  return (x, y) => {
    const srcX = columnFor(stripIndex(x), y);
    const srcY = pingPong(y, height);
    const i = (srcY * width + srcX) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
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

  if (pattern.type === 'image') return createImageSource(pattern, eyeSeparation);

  throw new Error(`Неизвестный тип паттерна: ${pattern.type}`);
}
