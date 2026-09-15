import { describe, expect, it } from 'vitest';
import { pngFilename } from '../export.js';

describe('pngFilename', () => {
  it('содержит дату и время, чтобы выгрузки не перетирали друг друга', () => {
    const name = pngFilename(new Date('2026-09-15T18:42:07.123Z'));
    expect(name).toBe('3d2sird-2026-09-15-18-42.png');
  });

  it('не содержит двоеточий — их не любят файловые системы', () => {
    expect(pngFilename(new Date('2026-01-02T03:04:05Z'))).not.toContain(':');
  });

  it('две выгрузки в разные минуты дают разные имена', () => {
    const first = pngFilename(new Date('2026-09-15T18:42:00Z'));
    const second = pngFilename(new Date('2026-09-15T18:43:00Z'));
    expect(first).not.toBe(second);
  });
});
