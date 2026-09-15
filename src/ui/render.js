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

// Буфер для растягивания черновика: заводится один раз и по требованию,
// чтобы модуль можно было импортировать в Node (тесты берут отсюда чистые
// функции, а DOM там нет).
let scratchCanvas = null;

export function drawStereogram(canvas, image, displaySize) {
  const width = displaySize?.width ?? image.width;
  const height = displaySize?.height ?? image.height;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d');
  if (width === image.width && height === image.height) {
    context.putImageData(image, 0, 0);
    return;
  }

  // Черновик при вращении считается в меньшем разрешении и растягивается:
  // точки становятся крупнее, зато кадр успевает за мышью. Сглаживание
  // выключено — размытые точки не сводятся глазами вообще, а крупные
  // хотя бы читаются. Итоговый кадр после остановки рисуется 1:1.
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = image.width;
  scratchCanvas.height = image.height;
  scratchCanvas.getContext('2d').putImageData(image, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(scratchCanvas, 0, 0, width, height);
}

// Размеры выхода. Стереограмма сводится глазами только при показе пиксель
// в пиксель: растянутый по CSS canvas пересемплирует точки, и пары
// перестают совпадать, поэтому «под ширину страницы» — единственный режим,
// который гарантированно смотрится на экране.
export function outputSize(resolution, availableWidth) {
  const width = resolution === 'fit' ? Math.max(320, availableWidth) : Number(resolution);
  return { width, height: Math.round(width * 0.7) };
}
