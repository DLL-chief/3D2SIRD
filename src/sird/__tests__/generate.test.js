import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generate } from '../generate.js';
import { makeHemisphereDepthMap } from '../synthetic.js';
import { encodePbm, decodePbm } from './pbm.js';
import { FIXTURE_DEPTH_MAP_SIZE, FIXTURE_PARAMS, FIXTURE_FILE } from './fixture-params.js';

const SIZE = FIXTURE_DEPTH_MAP_SIZE;

function generateFixtureImage() {
  return generate(makeHemisphereDepthMap(SIZE, SIZE), FIXTURE_PARAMS);
}

function readFixture() {
  return readFileSync(
    fileURLToPath(new URL(`../__fixtures__/${FIXTURE_FILE}`, import.meta.url)),
    'utf8',
  );
}

describe('generate: полусфера 256×256, seed 42', () => {
  it('выход совпадает по размерам с входной картой', () => {
    const image = generateFixtureImage();
    expect(image.width).toBe(SIZE);
    expect(image.height).toBe(SIZE);
    expect(image.data.length).toBe(SIZE * SIZE * 4);
  });

  it('детерминирован: два вызова дают одинаковые байты', () => {
    const a = generateFixtureImage();
    const b = generateFixtureImage();
    expect(Buffer.from(a.data.buffer)).toEqual(Buffer.from(b.data.buffer));
  });

  it('вне сферы паттерн повторяется с периодом ровно E', () => {
    const image = generateFixtureImage();
    const E = FIXTURE_PARAMS.eyeSeparation;
    // Полусфера занимает строки ~26..229 — строки выше целиком фон.
    for (const y of [0, 5, 12, 25]) {
      for (let x = 0; x < SIZE - E; x++) {
        const i = (y * SIZE + x) * 4;
        const j = i + E * 4;
        expect(image.data[i]).toBe(image.data[j]);
        expect(image.data[i + 1]).toBe(image.data[j + 1]);
        expect(image.data[i + 2]).toBe(image.data[j + 2]);
      }
    }
  });

  it('совпадает с эталоном из __fixtures__', () => {
    const fixtureText = readFixture();
    const fixture = decodePbm(fixtureText);
    const image = generateFixtureImage();
    expect(fixture.width).toBe(image.width);
    expect(fixture.height).toBe(image.height);
    expect(encodePbm(image)).toBe(fixtureText);
  });
});
