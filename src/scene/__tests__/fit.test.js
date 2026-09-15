import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitToUnitCube } from '../fit.js';

function boxOf(object) {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function makeMesh(width, height, depth) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
}

describe('fitToUnitCube', () => {
  it('вписывает модель в единичный куб по самой длинной стороне', () => {
    const fitted = fitToUnitCube(makeMesh(2, 4, 6));
    const size = boxOf(fitted).getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1, 6);
    // Пропорции модели сохраняются: масштаб один на все оси.
    expect(size.x).toBeCloseTo(2 / 6, 6);
    expect(size.y).toBeCloseTo(4 / 6, 6);
  });

  it('центрирует модель, смещённую от начала координат', () => {
    const mesh = makeMesh(2, 2, 2);
    mesh.position.set(10, -5, 3);
    const center = boxOf(fitToUnitCube(mesh)).getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(0, 6);
    expect(center.y).toBeCloseTo(0, 6);
    expect(center.z).toBeCloseTo(0, 6);
  });

  it('не переписывает поворот модели', () => {
    // Трансформация вешается на обёртку, поэтому собственный поворот
    // корня модели остаётся как был — иначе модель развернуло бы.
    const mesh = makeMesh(1, 2, 3);
    mesh.rotation.set(0.3, 0.4, 0.5);
    const fitted = fitToUnitCube(mesh);
    expect(fitted.children[0].rotation.x).toBeCloseTo(0.3, 6);
    expect(fitted.children[0].rotation.y).toBeCloseTo(0.4, 6);
    expect(fitted.children[0].rotation.z).toBeCloseTo(0.5, 6);
  });

  it('модель в миллиметрах и модель в метрах дают один результат', () => {
    // Ровно то, за чем нужен инвариант: масштаб исходного файла не должен
    // влиять на параметры глубины.
    const millimetres = boxOf(fitToUnitCube(makeMesh(1000, 2000, 500)));
    const metres = boxOf(fitToUnitCube(makeMesh(1, 2, 0.5)));
    expect(millimetres.getSize(new THREE.Vector3()).y).toBeCloseTo(
      metres.getSize(new THREE.Vector3()).y,
      6,
    );
  });

  it('плоская модель вписывается по оставшимся осям, без деления на ноль', () => {
    const size = boxOf(fitToUnitCube(makeMesh(4, 2, 0))).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1, 6);
    expect(size.y).toBeCloseTo(0.5, 6);
    expect(size.z).toBeCloseTo(0, 6);
  });

  it('пустой объект не ломает функцию', () => {
    const fitted = fitToUnitCube(new THREE.Group());
    expect(fitted.scale.x).toBe(1);
    expect(boxOf(fitted).isEmpty()).toBe(true);
  });
});
