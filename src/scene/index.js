// Сцена, камера и вращение мышью плюс загрузка модели. Наружу отдаётся
// только `{ scene, camera, controls }` — внутрь иерархии объектов другие
// модули не лезут (README модуля, инварианты).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitToUnitCube } from './fit.js';

// Модель после fitToUnitCube занимает единичный куб, а его диагональ —
// 1.73, поэтому при вращении силуэт шире самой модели. Камера отодвинута
// так, чтобы в кадр влезала именно диагональ и модель не обрезалась ни под
// каким углом.
const CAMERA_DISTANCE = 2.4;
const FIELD_OF_VIEW = 45;

const DEMO_GEOMETRIES = {
  sphere: () => new THREE.SphereGeometry(0.5, 64, 48),
  torus: () => new THREE.TorusGeometry(0.35, 0.16, 96, 48),
  knot: () => new THREE.TorusKnotGeometry(0.3, 0.1, 160, 32),
};

export function createScene(domElement) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  return { scene, camera, controls: attachControls(camera, domElement) };
}

// Управление вешается на несколько элементов сразу (предпросмотр сцены и
// сама стереограмма): все наборы контролов вращают одну камеру.
export function attachControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  // Затухание выключено намеренно: с ним камера продолжает ехать по
  // инерции ещё секунды после отпускания кнопки, а карта глубины и
  // стереограмма считаются разово по событию `end` — кадр разъехался бы с
  // тем, что видно в предпросмотре. Заодно событие `change` при затухании
  // сыпется каждый кадр, и любой дебаунс на нём не срабатывает вообще.
  controls.enableDamping = false;
  // Панорама выключена: цель у каждого набора контролов своя, и сдвиг
  // одной развёл бы наборы между собой — камера-то одна.
  controls.enablePan = false;
  controls.target.set(0, 0, 0);
  controls.update();
  return controls;
}

// Материалы модели заменяются на простой: этот модуль отвечает только за
// навигацию, а PBR-материалы из файла потребовали бы света и окружения.
// Для карты глубины материал всё равно подменяется в depth/.
function simplifyMaterials(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    if (node.material) disposeMaterial(node.material);
    node.material = new THREE.MeshNormalMaterial();
  });
  return object;
}

function disposeMaterial(material) {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

export function createDemoModel(kind = 'knot') {
  const mesh = new THREE.Mesh(DEMO_GEOMETRIES[kind](), new THREE.MeshNormalMaterial());
  return fitToUnitCube(mesh);
}

export async function loadModel(source) {
  const isFile = typeof File !== 'undefined' && source instanceof File;
  const url = isFile ? URL.createObjectURL(source) : source;
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    return fitToUnitCube(simplifyMaterials(gltf.scene));
  } finally {
    if (isFile) URL.revokeObjectURL(url);
  }
}

// Прежняя модель убирается из сцены с освобождением буферов: без этого
// каждая загруженная GLB оставляла бы за собой геометрию и текстуры в
// памяти GPU.
export function showModel(scene, model) {
  for (const child of [...scene.children]) {
    scene.remove(child);
    child.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      disposeMaterial(node.material);
    });
  }
  scene.add(model);
}
