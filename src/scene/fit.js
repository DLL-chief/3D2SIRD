import * as THREE from 'three';

// Модель вписывается в единичный куб и центрируется в начале координат
// (README модуля, инварианты): остальные модули не должны зависеть от
// масштаба исходного файла, где модель может быть и в миллиметрах, и в
// метрах, и смещена от начала координат.
//
// Трансформация вешается на обёртку-группу, а не на саму модель: у корня
// GLTF может быть собственный поворот или смещение, и переписывать его
// значило бы разворачивать модель непредсказуемо.
export function fitToUnitCube(object) {
  const box = new THREE.Box3().setFromObject(object);
  const group = new THREE.Group();

  if (box.isEmpty()) {
    group.add(object);
    return group;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  object.position.sub(center);
  group.add(object);
  group.scale.setScalar(maxDimension > 0 ? 1 / maxDimension : 1);
  return group;
}
