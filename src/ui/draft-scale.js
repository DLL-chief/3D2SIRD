// Подбор масштаба черновика при вращении.
//
// Жёсткое число тут не годится: скорость зависит от числа ядер, от GPU и от
// размера кадра, а «живым» вращение перестаёт быть где-то за 60 мс на
// кадр. Поэтому масштаб подстраивается по факту: медленно — уменьшаем,
// быстро — возвращаем детализацию.

export const DRAFT_SCALE_LIMITS = { min: 0.35, max: 1 };

const SLOW_FRAME_MS = 55;
const FAST_FRAME_MS = 25;
const STEP = 0.1;

export function nextDraftScale(scale, frameMs) {
  // Порядок важен: округление до десятых идёт ДО зажима, иначе минимум
  // 0.35 недостижим — шаг 0.1 от 0.4 уводит за границу, зажим возвращает
  // 0.35, а округление снова поднимает до 0.4, и масштаб залипает.
  // Округление само нужно, чтобы размер черновика не дрожал от
  // накопленной погрешности.
  const step = (value) => {
    const rounded = Math.round(value * 10) / 10;
    return Math.min(DRAFT_SCALE_LIMITS.max, Math.max(DRAFT_SCALE_LIMITS.min, rounded));
  };

  if (frameMs > SLOW_FRAME_MS) return step(scale - STEP);
  if (frameMs < FAST_FRAME_MS) return step(scale + STEP);
  return step(scale);
}
