// Подготовка пользовательской картинки под полосу узора.
// Масштабирование — задача этого модуля, а не `sird/`
// (docs/api_contracts.md, п.3).

// Полоса узора — одна на всю высоту кадра. Соблазнительно масштабировать
// картинку по ширине полосы с сохранением пропорций, но тогда от
// фотографии остаётся миниатюра (1600×1200 под полосу 90 px — это 90×68),
// а вертикальный тайлинг размножает её десятком зеркальных копий: замерено
// 9 разворотов по высоте кадра 678 px. Поэтому масштаб задаётся высотой
// кадра, а по ширине берётся срез — вертикального повтора тогда нет
// вообще, и в полосу попадают пиксели исходного разрешения.
export function sliceGeometry(
  { width: sourceWidth, height: sourceHeight },
  { frameHeight, sampleWidth, mode = 'strip', driftPerRow = 0 },
) {
  const height = Math.max(1, Math.round(frameHeight));
  const columns = Math.max(1, Math.round(sampleWidth));
  // Масштаб по высоте, пропорции сохраняются.
  const scaledWidth = Math.max(1, Math.round((sourceWidth * height) / sourceHeight));

  // `squeeze` укладывает в полосу всю картинку, поэтому сжимает её по
  // ширине сам — уменьшением через canvas, он усредняет пиксели (выборка
  // ближайшим соседом из большой картинки дала бы алиасинг).
  if (mode === 'squeeze') {
    return { width: columns, height, drawWidth: columns, offsetX: 0 };
  }

  // Остальным режимам нужен срез шириной ровно в то, что они читают:
  // `strip` — одна полоса, `drift` — полоса плюс путь, который её начало
  // проезжает за кадр. Лишние столбцы в кадр не попадут, а копия
  // `ImageData` уходит в каждый воркер, поэтому их незачем возить.
  const needed =
    mode === 'drift' ? Math.ceil(height * Math.abs(driftPerRow)) + columns : columns;
  const width = Math.min(scaledWidth, Math.max(1, needed));
  // Срез берётся из середины: на фотографии главное обычно там, а не у
  // левого края. Если срез шириной во всю картинку — сдвиг нулевой.
  return { width, height, drawWidth: scaledWidth, offsetX: Math.floor((scaledWidth - width) / 2) };
}

export function decodeImageFile(file) {
  return createImageBitmap(file);
}

export function textureToImageData(bitmap, options) {
  const { width, height, drawWidth, offsetX } = sliceGeometry(bitmap, options);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  // Рисуется вся картинка целиком со сдвигом влево: то, что не влезло в
  // полотно, отсекается — это и есть срез.
  context.drawImage(bitmap, -offsetX, 0, drawWidth, height);
  return context.getImageData(0, 0, width, height);
}
