import { describe, expect, it } from 'vitest';
import { blurRgba, modulate } from '../index.js';
import { generate } from '../../sird/generate.js';
import { separation } from '../../sird/separation.js';
import { makeHemisphereDepthMap } from '../../sird/synthetic.js';

function solid(width, height, [r, g, b]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('blurRgba', () => {
  it('ровное поле остаётся ровным, в том числе по углам', () => {
    // Если у краёв считать «за кадром чёрное», подложка темнеет по рамке
    // и кадр получает ложную виньетку. Поэтому столбцы и строки края
    // дублируются.
    const blurred = blurRgba(solid(16, 12, [200, 100, 50]), 5);
    for (let i = 0; i < blurred.length; i += 4) {
      expect([blurred[i], blurred[i + 1], blurred[i + 2]]).toEqual([200, 100, 50]);
    }
  });

  it('радиус 0 отдаёт копию', () => {
    const image = solid(4, 4, [10, 20, 30]);
    image.data[0] = 250;
    const blurred = blurRgba(image, 0);
    expect(Array.from(blurred)).toEqual(Array.from(image.data));
  });

  it('точка размазывается по окрестности и не выходит за неё', () => {
    const image = solid(21, 21, [0, 0, 0]);
    const centre = (10 * 21 + 10) * 4;
    image.data[centre] = 255;
    const blurred = blurRgba(image, 3);
    expect(blurred[centre]).toBeGreaterThan(0);
    expect(blurred[centre]).toBeLessThan(255);
    // Два прохода радиусом 3 — это ядро шириной 13, дальше нуль.
    expect(blurred[(10 * 21 + 3) * 4]).toBe(0);
  });

  it('альфа остаётся непрозрачной', () => {
    const blurred = blurRgba(solid(8, 8, [1, 2, 3]), 2);
    for (let i = 3; i < blurred.length; i += 4) expect(blurred[i]).toBe(255);
  });
});

describe('modulate', () => {
  const stereo = solid(4, 2, [255, 128, 0]);

  it('сила 0 — кадр не меняется', () => {
    expect(Array.from(modulate(stereo, solid(4, 2, [0, 0, 0]).data, 0))).toEqual(
      Array.from(stereo.data),
    );
  });

  it('белая подложка не меняет кадр ни при какой силе', () => {
    const white = solid(4, 2, [255, 255, 255]).data;
    expect(Array.from(modulate(stereo, white, 1))).toEqual(Array.from(stereo.data));
  });

  it('в самом тёмном месте подложки остаётся контраст 255·(1 − a)', () => {
    // Главное свойство: множитель никогда не меньше 1 − a, поэтому зерно
    // не пропадает даже под чёрным пятном фотографии — на этом держится
    // сведение (docs/adr/005).
    const black = solid(4, 2, [0, 0, 0]).data;
    expect(modulate(solid(4, 2, [255, 255, 255]), black, 0.6)[0]).toBe(102);
    expect(modulate(solid(4, 2, [255, 255, 255]), black, 1)[0]).toBe(0);
  });

  it('альфа остаётся непрозрачной', () => {
    const out = modulate(stereo, solid(4, 2, [10, 10, 10]).data, 0.5);
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });
});

describe('подложка не убивает стерео', () => {
  const WIDTH = 320;
  const HEIGHT = 160;
  const E = 180;
  const MU = 0.45;
  const FLOOR = 0.35;
  const BACKGROUND = separation(0, E, MU);

  const depth = Float32Array.from(makeHemisphereDepthMap(WIDTH, HEIGHT).data, (z) =>
    z > 0 ? FLOOR + (1 - FLOOR) * z : 0,
  );
  const stereo = generate(
    { width: WIDTH, height: HEIGHT, data: Float32Array.from(depth) },
    { eyeSeparation: E, depthStrength: MU, pattern: { type: 'noise', color: false, seed: 42 } },
  );

  // «Фотография»: плавные пятна во всю ширину с чёрным углом — самое
  // трудное место для подложки, там контраст точек падает сильнее всего.
  const photo = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const u = x / WIDTH;
      const v = y / HEIGHT;
      const wave = 0.5 + 0.5 * Math.sin(u * 7) * Math.cos(v * 5);
      const dark = Math.max(0, 1 - ((u - 0.8) ** 2 + (v - 0.8) ** 2) / 0.05);
      const level = Math.max(0, Math.min(1, 0.3 + 0.6 * wave - 0.9 * dark));
      const i = (y * WIDTH + x) * 4;
      photo[i] = 255 * level;
      photo[i + 1] = 255 * level;
      photo[i + 2] = 200 * level;
      photo[i + 3] = 255;
    }
  }

  // Та же проверка, что глазами: по готовой картинке ищется сдвиг, при
  // котором окно совпадает со сдвинутым, и сравнивается с сепарацией фона.
  // Берутся только пиксели, у которых и окно, и его пара целиком на фоне —
  // иначе мерился бы не узор, а край объекта.
  function backgroundRecovery(data) {
    const luma = new Float32Array(WIDTH * HEIGHT);
    for (let i = 0; i < luma.length; i++) {
      luma[i] = data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2];
    }
    const candidates = [];
    for (let d = separation(1, E, MU) - 10; d <= BACKGROUND + 10; d++) candidates.push(d);
    // Окно 21 px: на 11 px у двоичного шума случайное точное совпадение
    // на чужом сдвиге выпадает примерно раз на две сотни пикселей, и
    // эталон перестаёт быть эталоном.
    const half = 10;
    const span = candidates[candidates.length - 1] + half;

    let hit = 0;
    let all = 0;
    for (let y = 0; y < HEIGHT; y += 2) {
      for (let x = half; x + span < WIDTH; x += 2) {
        let clear = true;
        for (let k = x - half; k <= x + span && clear; k++) clear = depth[y * WIDTH + k] === 0;
        if (!clear) continue;

        let best = Infinity;
        let bestShift = -1;
        for (const d of candidates) {
          let ssd = 0;
          for (let k = -half; k <= half; k++) {
            const diff = luma[y * WIDTH + x + k] - luma[y * WIDTH + x + k + d];
            ssd += diff * diff;
          }
          if (ssd < best) {
            best = ssd;
            bestShift = d;
          }
        }
        all++;
        if (bestShift === BACKGROUND) hit++;
      }
    }
    expect(all).toBeGreaterThan(100);
    return hit / all;
  }

  it('без подложки сепарация фона восстанавливается полностью', () => {
    expect(backgroundRecovery(stereo.data)).toBe(1);
  });

  it('на дефолтной силе 0.6 сепарация фона всё ещё восстанавливается', () => {
    const blurred = blurRgba({ width: WIDTH, height: HEIGHT, data: photo }, 12);
    expect(backgroundRecovery(modulate(stereo, blurred, 0.6))).toBe(1);
  });

  it('на силе 1 подложка гасит точки и стерео начинает рассыпаться', () => {
    // Проверка, что предыдущий тест не просто «всегда единица»: при a=1
    // множитель доходит до нуля, зерна под тёмным пятном не остаётся.
    const blurred = blurRgba({ width: WIDTH, height: HEIGHT, data: photo }, 12);
    expect(backgroundRecovery(modulate(stereo, blurred, 1))).toBeLessThan(1);
  });
});
