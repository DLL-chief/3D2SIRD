// Временный стенд: гоняет генератор в Web Worker на синтетической
// полусфере и рисует результат в canvas. Будет заменён на настоящий UI
// (src/ui/) по мере выполнения беклога.

import { makeHemisphereDepthMap } from './sird/synthetic.js';

const WIDTH = 800;
const HEIGHT = 600;

const statusEl = document.getElementById('status');
const canvas = document.getElementById('output');
canvas.width = WIDTH;
canvas.height = HEIGHT;

const worker = new Worker(new URL('./sird/worker.js', import.meta.url), {
  type: 'module',
});

worker.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'error') {
    statusEl.textContent = `Ошибка генератора: ${msg.message}`;
    return;
  }
  canvas.getContext('2d').putImageData(msg.image, 0, 0);
  statusEl.textContent =
    `Готово за ${msg.ms.toFixed(0)} мс. Смотрите «сквозь» экран ` +
    '(параллельный взгляд) — в центре должна проявиться полусфера.';
};

const depthMap = makeHemisphereDepthMap(WIDTH, HEIGHT);
worker.postMessage(
  {
    depthMap,
    params: {
      eyeSeparation: 90,
      depthStrength: 1 / 3,
      crossEyed: false,
      pattern: { type: 'noise', color: false, seed: 42 },
    },
  },
  [depthMap.data.buffer],
);
