// Обёртка генератора для Web Worker. Формат сообщений —
// docs/api_contracts.md, п.4; буфер результата отдаётся через transfer.

import { generate } from './generate.js';

self.onmessage = (event) => {
  const { depthMap, params } = event.data;
  try {
    const start = performance.now();
    const image = generate(depthMap, params);
    const ms = performance.now() - start;
    self.postMessage({ type: 'done', image, ms }, [image.data.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
