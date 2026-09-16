// Фотография подложкой под готовую стереограмму.
//
// Зачем отдельный шаг после генератора: в кадре стереограммы видно ровно
// `round(E/2)` столбцов узора — кадр обязан быть периодичным с этим шагом,
// поэтому узнаваемой картинки из узора не выйдет никогда, сколько режимов
// выборки ни добавляй. Но стереосигнал живёт в высоких частотах: пары
// сводятся по совпадению мелких точек на расстоянии сепарации.
// Низкочастотная подложка диспаратность почти не несёт, значит её можно
// положить поверх готового кадра — фотография видна целиком и
// неискажённой, а стерео держится на сохранённом зерне.
//
// Контракт sird/ этот модуль не трогает: он работает с готовым RGBA.
// Граница, за которой стерео разваливается, замерена — см. README модуля.

// Размытие подложки. Двухпроходный box-фильтр: два прохода уже похожи на
// гауссиану, а считается за O(1) на пиксель — подложка пересчитывается при
// смене размера кадра, и лишние миллисекунды тут заметны.
export function blurRgba({ width, height, data }, radius, passes = 2) {
  const size = Math.max(0, Math.round(radius));
  let current = Float32Array.from(data);
  if (size === 0) return new Uint8ClampedArray(current);

  const next = new Float32Array(current.length);
  const window = 2 * size + 1;

  for (let pass = 0; pass < passes; pass++) {
    // По горизонтали: скользящая сумма, у краёв столбцы дублируются
    // (иначе подложка темнеет по рамке кадра).
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let k = -size; k <= size; k++) {
          sum += current[row + Math.min(width - 1, Math.max(0, k)) * 4 + channel];
        }
        for (let x = 0; x < width; x++) {
          next[row + x * 4 + channel] = sum / window;
          const out = Math.min(width - 1, Math.max(0, x - size));
          const inc = Math.min(width - 1, Math.max(0, x + size + 1));
          sum += current[row + inc * 4 + channel] - current[row + out * 4 + channel];
        }
      }
    }
    current.set(next);

    for (let x = 0; x < width; x++) {
      const column = x * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let k = -size; k <= size; k++) {
          sum += current[Math.min(height - 1, Math.max(0, k)) * width * 4 + column + channel];
        }
        for (let y = 0; y < height; y++) {
          next[y * width * 4 + column + channel] = sum / window;
          const out = Math.min(height - 1, Math.max(0, y - size));
          const inc = Math.min(height - 1, Math.max(0, y + size + 1));
          sum +=
            current[inc * width * 4 + column + channel] -
            current[out * width * 4 + column + channel];
        }
      }
    }
    current.set(next);
  }

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = current[i];
    out[i + 1] = current[i + 1];
    out[i + 2] = current[i + 2];
    out[i + 3] = 255;
  }
  return out;
}

// Готовый кадр умножается на подложку: out = stereo · (1 − a + a · photo).
// Умножение, а не сложение вокруг единицы: множитель никогда не больше 1,
// поэтому светлые точки не упираются в 255 и не теряют контраст. Контраст
// точек в самом тёмном месте подложки остаётся 255·(1 − a) — на этом и
// держится сведение.
export function modulate(stereo, photo, amount) {
  const a = Math.min(1, Math.max(0, amount));
  const out = new Uint8ClampedArray(stereo.data.length);
  for (let i = 0; i < out.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const factor = 1 - a + (a * photo[i + channel]) / 255;
      out[i + channel] = stereo.data[i + channel] * factor;
    }
    out[i + 3] = 255;
  }
  return out;
}
