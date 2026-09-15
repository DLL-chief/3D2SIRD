// Подготовка пользовательской текстуры под паттерн генератора.
// Масштабирование — задача этого модуля, а не `sird/`
// (docs/api_contracts.md, п.3).

// Пропорции сохраняются: узор тайлится и по вертикали, поэтому высота
// берётся из исходного соотношения сторон, а не подгоняется под кадр.
export function scaledSize(sourceWidth, sourceHeight, targetWidth) {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round((sourceHeight * width) / sourceWidth));
  return { width, height };
}

export function decodeImageFile(file) {
  return createImageBitmap(file);
}

export function textureToImageData(bitmap, targetWidth) {
  const { width, height } = scaledSize(bitmap.width, bitmap.height, targetWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}
