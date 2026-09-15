// Параметры эталона, общие для теста и make-fixture.mjs.

export const FIXTURE_DEPTH_MAP_SIZE = 256;

export const FIXTURE_PARAMS = {
  eyeSeparation: 90,
  depthStrength: 1 / 3,
  crossEyed: false,
  pattern: { type: 'noise', color: false, seed: 42 },
};

export const FIXTURE_FILE = 'hemisphere-256-seed42.pbm';
