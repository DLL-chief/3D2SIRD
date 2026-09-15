// Размытие карты глубины box-фильтром: стереограмма плохо передаёт резкие
// перепады глубины (docs/architecture.md, п.3.2) — на изломах рельефа они
// дают рваные края и «двоение».

// Фон (нули) в усреднении не участвует и остаётся нулём: иначе фильтр
// затягивает глубину модели на соседние фоновые пиксели, ступенька силуэта
// размазывается в пологую «юбку», и модель читается холмом на стене вместо
// предмета перед ней. Силуэт остаётся резким намеренно — окклюзию на нём
// генератор обрабатывает сам.
//
// Фильтр разделён на два прохода (по строкам, потом по столбцам) — это
// даёт тот же результат, что квадратное окно, но за O(r), а не O(r²).
// У края карты и у края модели окно усекается, среднее берётся по
// попавшим отсчётам, поэтому кайма не темнеет.
export function blurDepth(data, width, height, radius) {
  const r = Math.round(radius);
  if (r < 1) return data;

  const horizontal = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[row + x] === 0) continue;
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const sx = x + dx;
        if (sx < 0 || sx >= width) continue;
        if (data[row + sx] === 0) continue;
        sum += data[row + sx];
        count++;
      }
      horizontal[row + x] = sum / count;
    }
  }

  const out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (horizontal[y * width + x] === 0) continue;
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        if (horizontal[sy * width + x] === 0) continue;
        sum += horizontal[sy * width + x];
        count++;
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}
