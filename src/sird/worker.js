// Обёртка генератора для Web Worker. Формат сообщений —
// docs/api_contracts.md, п.4; буфер результата отдаётся через transfer.
//
// Кадр может приходить полосой (rowOffset > 0): строки в алгоритме
// независимы, поэтому пул воркеров считает кадр по частям (src/sird/pool.js).

import { generate } from './generate.js';

self.onmessage = (event) => {
  const { depthMap, params, rowOffset = 0 } = event.data;
  try {
    const start = performance.now();
    const image = generate(depthMap, params, rowOffset);
    const ms = performance.now() - start;
    self.postMessage({ type: 'done', image, ms, rowOffset }, [image.data.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
