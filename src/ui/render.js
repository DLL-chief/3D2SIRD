// Отрисовка карты глубины и стереограммы в canvas.

// Превью карты глубины — основной инструмент отладки, поэтому оно всегда
// на виду (README модуля, инварианты). Функция чистая: в Node нет
// ImageData, поэтому возвращается сам буфер RGBA, а не готовый ImageData.
export function depthToGrayscale({ width, height, data }) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    const level = Math.round(data[i] * 255);
    rgba[i * 4] = level;
    rgba[i * 4 + 1] = level;
    rgba[i * 4 + 2] = level;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

export function drawDepthMap(canvas, depthMap) {
  canvas.width = depthMap.width;
  canvas.height = depthMap.height;
  const image = new ImageData(depthToGrayscale(depthMap), depthMap.width, depthMap.height);
  canvas.getContext('2d').putImageData(image, 0, 0);
}

export function drawStereogram(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(image, 0, 0);
}

// Размеры выхода. Стереограмма сводится глазами только при показе пиксель
// в пиксель: растянутый по CSS canvas пересемплирует точки, и пары
// перестают совпадать, поэтому «под ширину страницы» — единственный режим,
// который гарантированно смотрится на экране.
export function outputSize(resolution, availableWidth) {
  const width = resolution === 'fit' ? Math.max(320, availableWidth) : Number(resolution);
  return { width, height: Math.round(width * 0.7) };
}
