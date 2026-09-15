import { describe, expect, it } from 'vitest';
import { nextDraftScale, DRAFT_SCALE_LIMITS } from '../draft-scale.js';

describe('nextDraftScale', () => {
  it('на медленном кадре уменьшает масштаб', () => {
    expect(nextDraftScale(0.8, 90)).toBe(0.7);
  });

  it('на быстром кадре возвращает детализацию', () => {
    expect(nextDraftScale(0.6, 12)).toBe(0.7);
  });

  it('в рабочем диапазоне ничего не меняет', () => {
    // Без этой зоны масштаб дёргался бы туда-сюда на каждом кадре.
    expect(nextDraftScale(0.6, 40)).toBe(0.6);
  });

  it('не опускается ниже минимума даже на очень медленной машине', () => {
    let scale = 1;
    for (let i = 0; i < 20; i++) scale = nextDraftScale(scale, 500);
    expect(scale).toBe(DRAFT_SCALE_LIMITS.min);
  });

  it('не поднимается выше полного разрешения', () => {
    let scale = 0.8;
    for (let i = 0; i < 20; i++) scale = nextDraftScale(scale, 5);
    expect(scale).toBe(DRAFT_SCALE_LIMITS.max);
  });

  it('сходится к рабочему диапазону, а не колеблется', () => {
    // Машина, где кадр занимает 60 мс при масштабе 1 и время падает
    // пропорционально площади: масштаб должен встать и перестать меняться.
    let scale = 1;
    const seen = [];
    for (let i = 0; i < 12; i++) {
      const frameMs = 60 * scale * scale;
      scale = nextDraftScale(scale, frameMs);
      seen.push(scale);
    }
    const settled = seen.slice(-4);
    expect(new Set(settled).size).toBe(1);
  });
});
