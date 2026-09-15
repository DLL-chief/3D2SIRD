import { describe, expect, it } from 'vitest';
import { generate } from '../generate.js';
import { makeHemisphereDepthMap } from '../synthetic.js';

const WIDTH = 240;
const HEIGHT = 120;
const PARAMS = {
  eyeSeparation: 180,
  depthStrength: 0.45,
  pattern: { type: 'noise', color: false, seed: 42 },
};

function fullFrame(depthMap, params = PARAMS) {
  return generate(
    { ...depthMap, data: Float32Array.from(depthMap.data) },
    params,
  ).data;
}

// То, что делает пул воркеров: кадр режется на полосы, каждая считается
// со своим смещением строк, результаты склеиваются.
function byBands(depthMap, bandCount, params = PARAMS) {
  const { width, height, data } = depthMap;
  const rowsPerBand = Math.ceil(height / bandCount);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < bandCount; index++) {
    const rowStart = index * rowsPerBand;
    const rowCount = Math.min(rowsPerBand, height - rowStart);
    if (rowCount <= 0) break;
    const band = generate(
      {
        width,
        height: rowCount,
        data: data.slice(rowStart * width, (rowStart + rowCount) * width),
      },
      params,
      rowStart,
    );
    out.set(band.data, rowStart * width * 4);
  }
  return out;
}

describe('расчёт кадра полосами', () => {
  const depthMap = makeHemisphereDepthMap(WIDTH, HEIGHT);

  it('деление на полосы не меняет результат', () => {
    // Главное свойство, на котором держится параллельный расчёт: сколько
    // бы воркеров ни было, картинка обязана быть той же.
    const whole = Buffer.from(fullFrame(depthMap).buffer);
    for (const bandCount of [2, 3, 4, 8, 16]) {
      expect(Buffer.from(byBands(depthMap, bandCount).buffer)).toEqual(whole);
    }
  });

  it('узор-картинка со сдвигом по строкам тоже делится полосами', () => {
    // В режиме 'drift' полоса текстуры зависит от номера строки, поэтому
    // именно здесь ошибка в rowOffset была бы видна как разрыв на границе
    // полос. Текстура узкая и «номерная»: любой сдвиг заметен.
    const texture = { width: 37, height: 11, data: new Uint8ClampedArray(37 * 11 * 4) };
    for (let y = 0; y < texture.height; y++) {
      for (let x = 0; x < texture.width; x++) {
        const i = (y * texture.width + x) * 4;
        texture.data[i] = x * 7;
        texture.data[i + 1] = y * 23;
        texture.data[i + 2] = 64;
        texture.data[i + 3] = 255;
      }
    }
    const params = {
      ...PARAMS,
      pattern: { type: 'image', data: texture, mode: 'drift', driftPerRow: 1 },
    };
    const whole = Buffer.from(fullFrame(depthMap, params).buffer);
    for (const bandCount of [2, 3, 5, 8]) {
      expect(Buffer.from(byBands(depthMap, bandCount, params).buffer)).toEqual(whole);
    }
  });

  it('число полос больше числа строк не ломает склейку', () => {
    const narrow = makeHemisphereDepthMap(WIDTH, 3);
    expect(Buffer.from(byBands(narrow, 8).buffer)).toEqual(
      Buffer.from(fullFrame(narrow).buffer),
    );
  });

  it('без смещения строк узор в полосах разъезжается', () => {
    // Проверка, что смещение действительно нужно: с rowOffset = 0 у каждой
    // полосы узор начинается заново, и склейка отличается от целого кадра.
    const { width, height, data } = depthMap;
    const rowsPerBand = Math.ceil(height / 4);
    const out = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < 4; index++) {
      const rowStart = index * rowsPerBand;
      const rowCount = Math.min(rowsPerBand, height - rowStart);
      const band = generate(
        {
          width,
          height: rowCount,
          data: data.slice(rowStart * width, (rowStart + rowCount) * width),
        },
        PARAMS,
      );
      out.set(band.data, rowStart * width * 4);
    }
    expect(Buffer.from(out.buffer)).not.toEqual(Buffer.from(fullFrame(depthMap).buffer));
  });
});
