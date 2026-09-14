// Перегенерация эталона для generate.test.js:
//   node src/sird/__tests__/make-fixture.mjs
// Запускать ТОЛЬКО при осознанном изменении алгоритма — новый эталон
// означает, что старый выход признан неправильным (см. AGENTS.md о тестах).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate } from '../generate.js';
import { makeHemisphereDepthMap } from '../synthetic.js';
import { encodePbm } from './pbm.js';
import { FIXTURE_DEPTH_MAP_SIZE, FIXTURE_PARAMS, FIXTURE_FILE } from './fixture-params.js';

const image = generate(
  makeHemisphereDepthMap(FIXTURE_DEPTH_MAP_SIZE, FIXTURE_DEPTH_MAP_SIZE),
  FIXTURE_PARAMS,
);
const path = fileURLToPath(new URL(`../__fixtures__/${FIXTURE_FILE}`, import.meta.url));
writeFileSync(path, encodePbm(image));
console.log(`Записан ${path}`);
