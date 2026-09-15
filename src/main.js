// Временный стенд: две стереограммы — синтетическая полусфера (эталон
// генератора, без Three.js) и тор-узел, прогнанный через depth/ → sird/.
// Будет заменён на настоящий UI (src/ui/) по мере выполнения беклога.

import * as THREE from 'three';
import { renderDepth } from './depth/index.js';
import { makeHemisphereDepthMap } from './sird/synthetic.js';

const WIDTH = 800;
const HEIGHT = 600;

const SIRD_PARAMS = {
  eyeSeparation: 90,
  depthStrength: 1 / 3,
  crossEyed: false,
  pattern: { type: 'noise', color: false, seed: 42 },
};

const statusEl = document.getElementById('status');

const worker = new Worker(new URL('./sird/worker.js', import.meta.url), {
  type: 'module',
});
const pendingReplies = [];
worker.onmessage = (event) => pendingReplies.shift()(event.data);

function generateStereogram(depthMap) {
  return new Promise((resolve, reject) => {
    pendingReplies.push((message) =>
      message.type === 'error'
        ? reject(new Error(message.message))
        : resolve(message),
    );
    // Буфер уходит в Worker через transfer и на этой стороне становится
    // пустым (docs/api_contracts.md, п.1) — всё, что нужно от карты
    // глубины, надо успеть сделать до этого вызова.
    worker.postMessage({ depthMap, params: SIRD_PARAMS }, [depthMap.data.buffer]);
  });
}

function drawStereogram(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(image, 0, 0);
}

function drawDepthPreview(canvas, depthMap) {
  const { width, height, data } = depthMap;
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const level = Math.round(data[i] * 255);
    image.data[i * 4] = level;
    image.data[i * 4 + 1] = level;
    image.data[i * 4 + 2] = level;
    image.data[i * 4 + 3] = 255;
  }
  canvas.getContext('2d').putImageData(image, 0, 0);
}

function buildKnotScene() {
  const scene = new THREE.Scene();
  // Геометрия кодом, а не файлом модели: в репозиторий не коммитятся
  // тестовые ассеты (AGENTS.md, п.6). Радиусы 0.3/0.1 вписывают узел в
  // единичный куб — как будет делать scene/ для загруженной модели.
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.3, 0.1, 160, 32),
    new THREE.MeshBasicMaterial(),
  );
  scene.add(knot);

  const camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.1, 10);
  camera.position.set(0, 0, 1.6);
  camera.lookAt(0, 0, 0);

  return { scene, camera };
}

async function main() {
  const hemisphere = await generateStereogram(
    makeHemisphereDepthMap(WIDTH, HEIGHT),
  );
  drawStereogram(document.getElementById('hemisphere-output'), hemisphere.image);

  const renderer = new THREE.WebGLRenderer();
  const { scene, camera } = buildKnotScene();
  // blur: 2 — на резких краях узла стереограмма иначе «рвётся»
  // (docs/architecture.md, п.3.2).
  const depthMap = renderDepth(renderer, scene, camera, {
    width: WIDTH,
    height: HEIGHT,
    blur: 2,
  });
  renderer.dispose();

  drawDepthPreview(document.getElementById('knot-depth'), depthMap);
  const knot = await generateStereogram(depthMap);
  drawStereogram(document.getElementById('knot-output'), knot.image);

  statusEl.textContent =
    `Готово: полусфера ${hemisphere.ms.toFixed(0)} мс, узел ` +
    `${knot.ms.toFixed(0)} мс. Смотрите «сквозь» экран (параллельный ` +
    'взгляд) — картинка должна проявиться объёмом.';
}

main().catch((error) => {
  statusEl.textContent = `Ошибка: ${error.message}`;
  throw error;
});
