// Минимальный кодек ASCII PBM (P1) для эталона: текстовый формат без
// зависимостей, диффабельный в PR и пролезающий через текстовые API.
// Годится только для строго чёрно-белых изображений — ровно то, что даёт
// генератор с паттерном {type: 'noise', color: false}.

export function encodePbm({ width, height, data }) {
  const lines = [`P1`, `# 3D2SIRD sird fixture`, `${width} ${height}`];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = data[i];
      if (
        (v !== 0 && v !== 255) ||
        data[i + 1] !== v ||
        data[i + 2] !== v ||
        data[i + 3] !== 255
      ) {
        throw new Error(`Пиксель (${x}, ${y}) не чёрно-белый — PBM не подходит`);
      }
      row += v === 0 ? '1' : '0'; // в PBM 1 — чёрный
    }
    lines.push(row);
  }
  return lines.join('\n') + '\n';
}

export function decodePbm(text) {
  const tokens = text
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens[0] !== 'P1') throw new Error('Ожидался ASCII PBM (P1)');
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const bits = tokens.slice(3).join('');
  if (bits.length !== width * height) {
    throw new Error(`Ожидалось ${width * height} бит, получено ${bits.length}`);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const v = bits[p] === '1' ? 0 : 255;
    data[p * 4] = v;
    data[p * 4 + 1] = v;
    data[p * 4 + 2] = v;
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}
