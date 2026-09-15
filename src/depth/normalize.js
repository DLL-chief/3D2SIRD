// Нормализация сырой линейной глубины в диапазон DepthMap
// (docs/api_contracts.md, п.1): 0 — фон/самое далёкое, 1 — ближе всего.

// Диапазон считается по фактическим min/max модели в кадре, а НЕ по
// near/far камеры: модель, занимающая малую долю диапазона камеры, иначе
// даёт почти плоский рельеф (README модуля, инварианты).
//
// floor приподнимает модель над фоном: её глубина укладывается в
// [floor, 1] вместо [0, 1], фон остаётся ровно 0. Без этого самый дальний
// видимый пиксель модели совпадает с фоном, силуэт теряет ступеньку и
// модель читается как холм на стене, а не как предмет перед ней.
export function normalizeDepth(viewZ, floor = 0) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < viewZ.length; i++) {
    const z = viewZ[i];
    // 0 — пиксель, куда не попала геометрия: шейдер пишет расстояние до
    // камеры, а оно у видимой геометрии всегда больше near > 0.
    if (z <= 0) continue;
    if (z < min) min = z;
    if (z > max) max = z;
  }

  const out = new Float32Array(viewZ.length);
  if (min === Infinity) return out;

  const span = max - min;
  for (let i = 0; i < viewZ.length; i++) {
    const z = viewZ[i];
    if (z <= 0) continue;
    const relief = span > 0 ? (max - z) / span : 1;
    out[i] = floor + (1 - floor) * relief;
  }
  return out;
}
