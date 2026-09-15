// Стереосепарация из статьи Thimbleby–Inglis–Witten: расстояние между
// парой пикселей, которые оба глаза сводят в одну точку глубины z.
// Формула живёт здесь, а не копией в генераторе и интерфейсе.

export function separation(z, eyeSeparation, depthStrength) {
  const depth = depthStrength * z;
  return Math.round((eyeSeparation * (1 - depth)) / (2 - depth));
}

// Сепарация округляется до целых пикселей, поэтому рельеф передаётся
// конечным числом ступеней. Их мало — гладкая поверхность видна террасами,
// поэтому число выводится в интерфейсе рядом с параметрами.
export function separationRange(eyeSeparation, depthStrength) {
  const far = separation(0, eyeSeparation, depthStrength);
  const near = separation(1, eyeSeparation, depthStrength);
  return { near, far, levels: far - near + 1 };
}
