// Экспорт стереограммы в PNG.

// Имя со временем, чтобы несколько выгрузок подряд не перетирали друг
// друга в папке загрузок. Двоеточия из ISO-времени убираются: в именах
// файлов их не любят ни Windows, ни macOS.
export function pngFilename(date) {
  const stamp = date.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `3d2sird-${stamp}.png`;
}

export function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Браузер не отдал PNG из canvas'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      resolve(blob.size);
    }, 'image/png');
  });
}
