// Интерфейс: связывает scene → depth → sird (в Worker) → canvas → PNG.
// Точка входа модуля, `src/main.js` только зовёт mountUi().

import * as THREE from 'three';
import {
  createScene,
  attachControls,
  createDemoModel,
  loadModel,
  showModel,
} from '../scene/index.js';
import { renderDepth } from '../depth/index.js';
import { blurDepth } from '../depth/blur.js';
import { makeHemisphereDepthMap } from '../sird/synthetic.js';
import { separationRange } from '../sird/separation.js';
import { createGeneratorPool } from '../sird/pool.js';
import { createControls } from './controls.js';
import { drawDepthMap, drawStereogram, outputSize } from './render.js';
import { downloadCanvasPng, pngFilename } from './export.js';
import { decodeImageFile, textureToImageData } from './texture.js';
import { nextDraftScale, draftEyeSeparation } from './draft-scale.js';

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
  // Заглушка из index.html больше не нужна: дальше разметку держит модуль.
  root.textContent = '';

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
  // Вторая пара «рук» на самой стереограмме: так модель можно крутить, не
  // отрывая глаз от картинки и не теряя сведение.
  const stereogramOrbit = attachControls(camera, outputCanvas);
  camera.aspect = SCENE_VIEW_WIDTH / SCENE_VIEW_HEIGHT;
  camera.updateProjectionMatrix();
  showModel(scene, createDemoModel('sphere'));

  // OrbitControls зовёт свой update() из обработчиков сам (затухание
  // выключено), поэтому здесь остаётся только рисовать предпросмотр.
  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // Кадр считается полосами в нескольких воркерах — иначе вращение в
  // реальном времени не укладывается в кадр (docs/adr/004). Воркеров по
  // числу ядер: работа по строкам однородна, дробить мельче незачем.
  const pool = createGeneratorPool(
    Math.max(1, Math.min(navigator.hardwareConcurrency ?? 4, 8)),
  );

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

  // Картинка для узора хранится как ImageBitmap: срез зависит от E, от
  // высоты кадра и от режима, поэтому готовится заново под каждый
  // пересчёт. Результат кэшируется — при вращении ничего из этого не
  // меняется, а getImageData на каждый кадр стоит миллисекунды.
  let texture = null;
  let textureSlice = null;

  function textureData(options) {
    const key = JSON.stringify(options);
    if (textureSlice?.bitmap !== texture || textureSlice.key !== key) {
      textureSlice = { bitmap: texture, key, data: textureToImageData(texture, options) };
    }
    return textureSlice.data;
  }

  function patternFor(values, period, frameHeight) {
    if (values.pattern === 'image' && texture) {
      // Период узора — сепарация фона round(E/2), а не E: именно с таким
      // шагом повторяется полоса (docs/api_contracts.md, п.3). При mirror
      // исходных столбцов нужно вдвое меньше — вторую половину полосы
      // генератор получает отражением.
      const sampleWidth = values.mirror ? Math.ceil(period / 2) : period;
      return {
        type: 'image',
        data: textureData({
          frameHeight,
          sampleWidth,
          mode: values.patternMode,
          driftPerRow: values.driftPerRow,
        }),
        mode: values.patternMode,
        mirror: values.mirror,
        driftPerRow: values.driftPerRow,
      };
    }
    return { type: 'noise', color: values.pattern === 'noise-color', seed: 42 };
  }

  // Во время вращения кадр считается в уменьшенном масштабе и растягивается
  // на полотно: так вся цепочка depth → sird укладывается в кадр. После
  // остановки идёт итоговый расчёт пиксель в пиксель (docs/adr/004).
  // Масштаб подстраивается по факту — см. draft-scale.js.
  let draftScale = 0.6;

  async function render(mode) {
    const values = controls.read();
    controls.showValues(values);

    const display = outputSize(values.resolution, root.clientWidth);
    const scale = mode === 'draft' ? draftScale : 1;
    const width = Math.round(display.width * scale);
    const height = Math.round(display.height * scale);
    const frameStarted = performance.now();

    const depthMap = buildDepthMap(values, width, height);
    drawDepthMap(depthCanvas, depthMap);

    // Экранные числа (их видит пользователь) считаются по полному E, а
    // генератору на черновике уходит уменьшенное: после растяжения
    // сепарация возвращается к той же, и сведение глаз не сбивается.
    const onScreen = separationRange(values.eyeSeparation, values.depthStrength);
    const frameEyeSeparation =
      mode === 'draft'
        ? draftEyeSeparation(values.eyeSeparation, scale)
        : values.eyeSeparation;
    const frameSeparation = separationRange(frameEyeSeparation, values.depthStrength);

    const result = await pool.generate(depthMap, {
      eyeSeparation: frameEyeSeparation,
      depthStrength: values.depthStrength,
      crossEyed: values.crossEyed,
      pattern: patternFor(values, frameSeparation.far, height),
    });

    drawStereogram(outputCanvas, result.image, display);

    // Масштаб черновика меряется по всей цепочке, а не по одному
    // генератору: карта глубины считается в том же кадре.
    if (mode === 'draft') {
      draftScale = nextDraftScale(draftScale, performance.now() - frameStarted);
    }

    const scaled = display.width > root.clientWidth;
    status.textContent =
      (mode === 'draft'
        ? `Черновик ${width}×${height} (вращение), `
        : `${display.width}×${display.height}, `) +
      `${result.ms.toFixed(0)} мс в ${result.bands} потоках. ` +
      `Ступеней рельефа: ${frameSeparation.levels} ` +
      `(сепарация на экране ${onScreen.near}..${onScreen.far} px, ` +
      `повторов узора по ширине: ${(display.width / onScreen.far).toFixed(1)}).` +
      (values.model === 'hemisphere'
        ? ' Карта считается формулой, сцена не используется.'
        : '') +
      (values.pattern === 'image' && !texture
        ? ' Картинка для узора не выбрана — рисую случайными точками.'
        : '') +
      (scaled
        ? ' Картинка шире страницы: в PNG она годится, а на экране сводится' +
          ' только при показе пиксель в пиксель — для просмотра берите' +
          ' «под ширину страницы».'
        : '');
  }

  // Расчёты идут строго по одному, а лишние запросы схлопываются в один
  // отложенный: при вращении события сыплются чаще, чем считается кадр, и
  // очередь иначе растёт без предела. Итоговый кадр в очереди черновик не
  // вытесняет (README модуля, инварианты).
  let running = false;
  let queued = null;

  function requestFrame(mode) {
    if (running) {
      queued = queued === 'final' ? 'final' : mode;
      return;
    }
    running = true;
    controls.setBusy(true);
    render(mode)
      .catch((error) => {
        status.textContent = `Ошибка: ${error.message}`;
      })
      .finally(() => {
        running = false;
        controls.setBusy(false);
        if (queued) {
          const next = queued;
          queued = null;
          requestFrame(next);
        }
      });
  }

  let timer;
  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(() => requestFrame('final'), 150);
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
  controls.onTexture(async (file) => {
    status.textContent = `Загружаю ${file.name}…`;
    try {
      texture = await decodeImageFile(file);
      controls.setPattern('image');
      scheduleRefresh();
    } catch (error) {
      status.textContent = `Не удалось открыть ${file.name}: ${error.message}`;
    }
  });
  controls.onExport(async () => {
    const size = await downloadCanvasPng(outputCanvas, pngFilename(new Date()));
    status.textContent = `${status.textContent} PNG сохранён, ${Math.round(size / 1024)} КБ.`;
  });

  // Вращение и зум меняют кадр, значит и карту глубины. Пока мышь ведёт
  // модель (`change`), считаются черновики — стереограмма живёт вместе с
  // вращением; по завершении жеста (`end`) идёт итоговый кадр в полном
  // разрешении. Без дебаунса: лишние запросы схлопывает requestFrame.
  for (const set of [orbit, stereogramOrbit]) {
    set.addEventListener('change', () => requestFrame('draft'));
    set.addEventListener('end', () => requestFrame('final'));
  }
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
