// Синтетическая карта глубины «полусфера радиусом 0.4·min(w,h) в центре
// над плоским фоном 0» (docs/api_contracts.md, п.5). Используется тестами
// и временным стендом; в продакшен-потоке карту даёт depth/.

export function makeHemisphereDepthMap(width, height) {
  const data = new Float32Array(width * height);
  const r = 0.4 * Math.min(width, height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      data[y * width + x] = d2 <= r * r ? Math.sqrt(1 - d2 / (r * r)) : 0;
    }
  }
  return { width, height, data };
}
