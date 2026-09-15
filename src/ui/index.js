// Интерфейс: связывает scene → depth → sird (в Worker) → canvas → PNG.
// Точка входа модуля, `src/main.js` только зовёт mountUi().

import * as THREE from 'three';
import { createScene, createDemoModel, loadModel, showModel } from '../scene/index.js';
import { renderDepth } from '../depth/index.js';
import { blurDepth } from '../depth/blur.js';
import { makeHemisphereDepthMap } from '../sird/synthetic.js';
import { separationRange } from '../sird/separation.js';
import { createControls } from './controls.js';
import { drawDepthMap, drawStereogram, outputSize } from './render.js';
import { downloadCanvasPng, pngFilename } from './export.js';

const SCENE_VIEW_WIDTH = 320;
const SCENE_VIEW_HEIGHT = 240;

function element(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function figure(canvas, caption) {
  const wrapper = element('figure');
  const text = element('figcaption');
  text.textContent = caption;
  wrapper.append(canvas, text);
  return wrapper;
}

export function mountUi(root) {
  const controls = createControls();
  const status = element('p');
  status.id = 'status';
  status.textContent = 'Генерация…';

  const sceneCanvas = element('canvas');
  sceneCanvas.id = 'scene-view';
  const depthCanvas = element('canvas');
  depthCanvas.id = 'depth-preview';
  const outputCanvas = element('canvas');
  outputCanvas.id = 'output';

  const views = element('div', 'views');
  views.append(
    figure(sceneCanvas, 'Сцена — крутите мышью'),
    figure(depthCanvas, 'Карта глубины: белое ближе, чёрное — фон'),
  );
  root.append(controls.root, status, views, outputCanvas);

  const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(SCENE_VIEW_WIDTH, SCENE_VIEW_HEIGHT, false);

  const { scene, camera, controls: orbit } = createScene(sceneCanvas);
  camera.aspect = SCENE_VIEW_WIDTH / SCENE_VIEW_HEIGHT;
  camera.updateProjectionMatrix();
  showModel(scene, createDemoModel('sphere'));

  // OrbitControls зовёт свой update() из обработчиков сам (затухание
  // выключено), поэтому здесь остаётся только рисовать предпросмотр.
  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  const worker = new Worker(new URL('../sird/worker.js', import.meta.url), {
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

  function buildDepthMap(values, width, height) {
    const { blur, floor } = values;
    if (values.model === 'hemisphere') {
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
    // Сцена и камера уходят в depth/ как есть: он подменяет материал и
    // аспект камеры на время рендера и возвращает всё обратно, поэтому
    // предпросмотр от этого не ломается.
    return renderDepth(renderer, scene, camera, { width, height, blur, floor });
  }

  // Каждый запуск получает номер: результат устаревшего запроса
  // выбрасывается, иначе на экран успевает попасть картинка от предыдущего
  // положения ползунка (README модуля, инварианты).
  let currentRun = 0;

  async function refresh() {
    const run = ++currentRun;
    const values = controls.read();
    controls.showValues(values);
    controls.setBusy(true);

    const { width, height } = outputSize(values.resolution, root.clientWidth);
    const depthMap = buildDepthMap(values, width, height);
    drawDepthMap(depthCanvas, depthMap);

    const result = await generateStereogram(depthMap, {
      eyeSeparation: values.eyeSeparation,
      depthStrength: values.depthStrength,
      crossEyed: values.crossEyed,
      pattern: { type: 'noise', color: false, seed: 42 },
    });
    if (run !== currentRun) return;

    drawStereogram(outputCanvas, result.image);
    controls.setBusy(false);

    const { near, far, levels } = separationRange(
      values.eyeSeparation,
      values.depthStrength,
    );
    const scaled = width > root.clientWidth;
    status.textContent =
      `${width}×${height}, ${result.ms.toFixed(0)} мс. ` +
      `Ступеней рельефа: ${levels} (сепарация ${near}..${far} px, ` +
      `повторов узора по ширине: ${(width / far).toFixed(1)}).` +
      (values.model === 'hemisphere'
        ? ' Карта считается формулой, сцена не используется.'
        : '') +
      (scaled
        ? ' Картинка шире страницы: в PNG она годится, а на экране сводится' +
          ' только при показе пиксель в пиксель — для просмотра берите' +
          ' «под ширину страницы».'
        : '');
  }

  let timer;
  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      refresh().catch((error) => {
        status.textContent = `Ошибка: ${error.message}`;
        controls.setBusy(false);
        throw error;
      });
    }, 150);
  }

  controls.onModelChange((kind) => {
    // hemisphere считается формулой, loaded уже в сцене — демо-геометрия
    // собирается только для встроенных моделей.
    if (kind !== 'hemisphere' && kind !== 'loaded') {
      showModel(scene, createDemoModel(kind));
    }
    scheduleRefresh();
  });
  controls.onInput(scheduleRefresh);
  controls.onFile(useFile);
  controls.onExport(async () => {
    const size = await downloadCanvasPng(outputCanvas, pngFilename(new Date()));
    status.textContent = `${status.textContent} PNG сохранён, ${Math.round(size / 1024)} КБ.`;
  });

  // Вращение и зум меняют кадр, значит и карту глубины. Пересчёт по `end`
  // (отпустили кнопку, довернули колесом), а не по `change`: последний
  // сыплется на каждое движение мыши, и генератор не успевал бы за жестом.
  orbit.addEventListener('end', scheduleRefresh);
  // При изменении ширины окна стереограмму надо пересчитать, а не
  // растягивать готовую — растянутая не сводится.
  window.addEventListener('resize', scheduleRefresh);

  async function useFile(file) {
    status.textContent = `Загружаю ${file.name}…`;
    try {
      showModel(scene, await loadModel(file));
      controls.setModel('loaded');
      scheduleRefresh();
    } catch (error) {
      status.textContent = `Не удалось открыть ${file.name}: ${error.message}`;
    }
  }

  document.addEventListener('dragover', (event) => {
    event.preventDefault();
    document.body.classList.add('dragover');
  });
  document.addEventListener('dragleave', () =>
    document.body.classList.remove('dragover'),
  );
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    document.body.classList.remove('dragover');
    const [file] = event.dataTransfer.files;
    if (file) useFile(file);
  });

  animate();
  scheduleRefresh();
}
