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

function fullFrame(depthMap) {
  return generate(
    { ...depthMap, data: Float32Array.from(depthMap.data) },
    PARAMS,
  ).data;
}

// То, что делает пул воркеров: кадр режется на полосы, каждая считается
// со своим смещением строк, результаты склеиваются.
function byBands(depthMap, bandCount) {
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
      PARAMS,
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
