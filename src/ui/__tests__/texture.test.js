import { describe, expect, it } from 'vitest';
import { scaledSize } from '../texture.js';

describe('scaledSize', () => {
  it('ставит ширину по периоду узора и сохраняет пропорции', () => {
    expect(scaledSize(800, 600, 90)).toEqual({ width: 90, height: 68 });
  });

  it('вытянутая по вертикали картинка остаётся вытянутой', () => {
    const { width, height } = scaledSize(200, 1000, 90);
    expect(width).toBe(90);
    expect(height).toBe(450);
  });

  it('не выдаёт нулевую высоту на очень широкой картинке', () => {
    // Панорама 4000×20 при ширине узора 90 дала бы высоту 0.45 —
    // округление до нуля означало бы пустой узор.
    expect(scaledSize(4000, 20, 90).height).toBe(1);
  });

  it('округляет дробную целевую ширину', () => {
    expect(scaledSize(100, 100, 45.4)).toEqual({ width: 45, height: 45 });
  });
});
