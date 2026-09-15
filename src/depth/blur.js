// Размытие карты глубины box-фильтром: стереограмма плохо передаёт резкие
// перепады глубины (docs/architecture.md, п.3.2) — на границах модели они
// дают рваные края и «двоение».

// Фильтр разделён на два прохода (по строкам, потом по столбцам) — это
// даёт тот же результат, что квадратное окно, но за O(r), а не O(r²).
// У края карты окно усекается, среднее берётся по попавшим в карту
// отсчётам, поэтому кайма не темнеет.
export function blurDepth(data, width, height, radius) {
  const r = Math.round(radius);
  if (r < 1) return data;

  const horizontal = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const sx = x + dx;
        if (sx < 0 || sx >= width) continue;
        sum += data[row + sx];
        count++;
      }
      horizontal[row + x] = sum / count;
    }
  }

  const out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        sum += horizontal[sy * width + x];
        count++;
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}
