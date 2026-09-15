// Временный стенд: подбор параметров стереограммы глазами. Собирает сцену
// Three.js, гоняет её через depth/ → sird/ и перерисовывает на каждое
// движение ползунка. Будет заменён на настоящий UI (src/ui/).

import * as THREE from 'three';
import { renderDepth } from './depth/index.js';
import { blurDepth } from './depth/blur.js';
import { makeHemisphereDepthMap } from './sird/synthetic.js';

const GEOMETRIES = {
  sphere: () => new THREE.SphereGeometry(0.4, 64, 48),
  torus: () => new THREE.TorusGeometry(0.28, 0.14, 96, 48),
  knot: () => new THREE.TorusKnotGeometry(0.3, 0.1, 160, 32),
};

const statusEl = document.getElementById('status');
const outputCanvas = document.getElementById('output');
const previewCanvas = document.getElementById('depth-preview');

const inputs = {
  object: document.getElementById('object'),
  eyeSeparation: document.getElementById('eye'),
  depthStrength: document.getElementById('mu'),
  blur: document.getElementById('blur'),
  floor: document.getElementById('floor'),
  crossEyed: document.getElementById('cross-eyed'),
};

const worker = new Worker(new URL('./sird/worker.js', import.meta.url), {
  type: 'module',
});
const pendingReplies = [];
worker.onmessage = (event) => pendingReplies.shift()(event.data);

function generateStereogram(depthMap, params) {
  return new Promise((resolve, reject) => {
    pendingReplies.push((message) =>
      message.type === 'error'
        ? reject(new Error(message.message))
        : resolve(message),
    );
    // Буфер уходит в Worker через transfer и здесь становится пустым
    // (docs/api_contracts.md, п.1) — превью надо рисовать до этого вызова.
    worker.postMessage({ depthMap, params }, [depthMap.data.buffer]);
  });
}

// Рендерер создаётся один раз: браузер держит около 16 WebGL-контекстов, и
// новый рендерер на каждое движение ползунка быстро упёрся бы в лимит.
let renderer;

function buildDepthMap({ object, width, height, blur, floor }) {
  if (object === 'hemisphere') {
    const source = makeHemisphereDepthMap(width, height).data;
    const data = Float32Array.from(source, (z) =>
      z > 0 ? floor + (1 - floor) * z : 0,
    );
    return {
      width,
      height,
      data: blur > 0 ? blurDepth(data, width, height, blur) : data,
    };
  }

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(GEOMETRIES[object](), new THREE.MeshBasicMaterial());
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
  camera.position.set(0, 0, 1.6);
  camera.lookAt(0, 0, 0);

  if (!renderer) renderer = new THREE.WebGLRenderer();
  const depthMap = renderDepth(renderer, scene, camera, {
    width,
    height,
    blur,
    floor,
  });

  mesh.geometry.dispose();
  mesh.material.dispose();
  return depthMap;
}

function drawDepthPreview(depthMap) {
  const { width, height, data } = depthMap;
  previewCanvas.width = width;
  previewCanvas.height = height;
  const image = new ImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const level = Math.round(data[i] * 255);
    image.data[i * 4] = level;
    image.data[i * 4 + 1] = level;
    image.data[i * 4 + 2] = level;
    image.data[i * 4 + 3] = 255;
  }
  previewCanvas.getContext('2d').putImageData(image, 0, 0);
}

function readSettings() {
  return {
    object: inputs.object.value,
    eyeSeparation: Number(inputs.eyeSeparation.value),
    depthStrength: Number(inputs.depthStrength.value),
    blur: Number(inputs.blur.value),
    floor: Number(inputs.floor.value),
    crossEyed: inputs.crossEyed.checked,
  };
}

function showSettings(settings) {
  document.getElementById('eye-out').textContent = settings.eyeSeparation;
  document.getElementById('mu-out').textContent = settings.depthStrength.toFixed(2);
  document.getElementById('blur-out').textContent = settings.blur;
  document.getElementById('floor-out').textContent = settings.floor.toFixed(2);
}

async function refresh() {
  const settings = readSettings();
  showSettings(settings);

  // Стереограмма рисуется пиксель в пиксель: если браузер растянет canvas
  // по CSS, точки пересемплируются и пары перестанут совпадать — тогда
  // картинка не сводится глазами вообще.
  const width = Math.max(320, document.querySelector('main').clientWidth);
  const height = Math.round(width * 0.7);

  const depthMap = buildDepthMap({ ...settings, width, height });
  drawDepthPreview(depthMap);

  const { eyeSeparation: E, depthStrength: mu } = settings;
  const sep = (z) => Math.round((E * (1 - mu * z)) / (2 - mu * z));
  const levels = sep(0) - sep(1) + 1;

  const result = await generateStereogram(depthMap, {
    eyeSeparation: E,
    depthStrength: mu,
    crossEyed: settings.crossEyed,
    pattern: { type: 'noise', color: false, seed: 42 },
  });

  outputCanvas.width = result.image.width;
  outputCanvas.height = result.image.height;
  outputCanvas.getContext('2d').putImageData(result.image, 0, 0);

  statusEl.textContent =
    `${width}×${height}, ${result.ms.toFixed(0)} мс. ` +
    `Ступеней рельефа: ${levels} (сепарация ${sep(1)}..${sep(0)} px, ` +
    `повторов узора по ширине: ${(width / sep(0)).toFixed(1)}).`;
}

let timer;
function scheduleRefresh() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    refresh().catch((error) => {
      statusEl.textContent = `Ошибка: ${error.message}`;
      throw error;
    });
  }, 150);
}

for (const input of Object.values(inputs)) {
  input.addEventListener('input', scheduleRefresh);
}
// При изменении ширины окна стереограмму надо пересчитать, а не растягивать
// готовую — растянутая не сводится.
window.addEventListener('resize', scheduleRefresh);

scheduleRefresh();
