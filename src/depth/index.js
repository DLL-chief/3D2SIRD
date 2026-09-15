// Рендер сцены в карту глубины. Контракт выхода — DepthMap из
// docs/api_contracts.md, п.1.

import * as THREE from 'three';
import { normalizeDepth } from './normalize.js';
import { blurDepth } from './blur.js';

// Свой шейдер вместо THREE.MeshDepthMaterial: тот пишет перспективную
// (нелинейную) глубину, на ней дальняя половина модели схлопывается почти
// в одно значение. Здесь во фрагмент уходит -viewPosition.z — расстояние
// от камеры до точки в единицах сцены, линейное по определению.
const linearDepthMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    varying float vViewZ;
    void main() {
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      vViewZ = -viewPosition.z;
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  fragmentShader: `
    varying float vViewZ;
    void main() {
      gl_FragColor = vec4(vViewZ, 0.0, 0.0, 1.0);
    }
  `,
});

export function renderDepth(
  renderer,
  scene,
  camera,
  { width, height, blur = 0, floor = 0 },
) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });

  const previousTarget = renderer.getRenderTarget();
  const previousClearColor = renderer.getClearColor(new THREE.Color());
  const previousClearAlpha = renderer.getClearAlpha();
  const previousOverride = scene.overrideMaterial;
  const previousAspect = camera.aspect;

  // Фон = ровно 0 (README модуля, инварианты): в пикселе без геометрии
  // остаётся цвет очистки, и нормализация отличает его от модели.
  renderer.setClearColor(0x000000, 0);
  scene.overrideMaterial = linearDepthMaterial;
  // Аспект камеры принадлежит вызывающей стороне, но при несовпадении с
  // размером карты кадр вышел бы растянутым — правим на время рендера и
  // возвращаем как было.
  if (camera.isPerspectiveCamera && previousAspect !== width / height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);

  const rgba = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, rgba);

  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(previousClearColor, previousClearAlpha);
  scene.overrideMaterial = previousOverride;
  if (camera.aspect !== previousAspect) {
    camera.aspect = previousAspect;
    camera.updateProjectionMatrix();
  }
  target.dispose();

  // readRenderTargetPixels отдаёт строки снизу вверх (начало координат
  // WebGL — левый нижний угол), а DepthMap идёт сверху вниз, как
  // ImageData — переворачиваем.
  const viewZ = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const source = (height - 1 - y) * width;
    const destination = y * width;
    for (let x = 0; x < width; x++) {
      viewZ[destination + x] = rgba[(source + x) * 4];
    }
  }

  const data = normalizeDepth(viewZ, floor);
  return { width, height, data: blur > 0 ? blurDepth(data, width, height, blur) : data };
}
