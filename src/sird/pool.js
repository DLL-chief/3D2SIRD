// Пул воркеров: кадр делится на горизонтальные полосы и считается
// параллельно. Строки в алгоритме TIW независимы друг от друга (ссылки
// `same` живут внутри строки), поэтому деление не меняет результат — при
// том же seed выход совпадает с расчётом целиком, сколько бы полос ни
// было. Обоснование выбора против GPU-версии — docs/adr/004.

// Полос столько же, сколько воркеров: дробить мельче незачем, работа по
// строкам однородна.
export function createGeneratorPool(size) {
  const workers = [];
  for (let i = 0; i < size; i++) {
    workers.push(
      new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
    );
  }

  function runBand(worker, depthMap, params, rowOffset) {
    return new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'error') reject(new Error(message.message));
        else resolve(message);
      };
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ depthMap, params, rowOffset }, [depthMap.data.buffer]);
    });
  }

  async function generate(depthMap, params) {
    const { width, height, data } = depthMap;
    const rowsPerBand = Math.ceil(height / workers.length);
    const started = performance.now();

    const bands = [];
    for (let index = 0; index < workers.length; index++) {
      const rowStart = index * rowsPerBand;
      const rowCount = Math.min(rowsPerBand, height - rowStart);
      if (rowCount <= 0) break;
      // slice копирует полосу — нужен отдельный буфер на воркер, потому
      // что он уходит туда через transfer.
      bands.push(
        runBand(
          workers[index],
          {
            width,
            height: rowCount,
            data: data.slice(rowStart * width, (rowStart + rowCount) * width),
          },
          params,
          rowStart,
        ).then((message) => ({ rowStart, image: message.image })),
      );
    }

    const results = await Promise.all(bands);
    const out = new Uint8ClampedArray(width * height * 4);
    for (const { rowStart, image } of results) {
      out.set(image.data, rowStart * width * 4);
    }

    return {
      image: new ImageData(out, width, height),
      ms: performance.now() - started,
      bands: results.length,
    };
  }

  return {
    size: workers.length,
    generate,
    dispose() {
      for (const worker of workers) worker.terminate();
    },
  };
}
