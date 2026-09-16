// Панель контролов: только DOM и чтение значений, без знания о генераторе.

const MODELS = [
  { value: 'sphere', label: 'Сфера' },
  { value: 'torus', label: 'Тор' },
  { value: 'knot', label: 'Тор-узел' },
  { value: 'hemisphere', label: 'Полусфера (синтетика, без scene/depth)' },
];

// Разрешение выхода отделено от размера на экране: печать и обои просят
// больше пикселей, но стереограмма сводится глазами только при показе
// пиксель в пиксель, поэтому по умолчанию — под ширину страницы.
const RESOLUTIONS = [
  { value: 'fit', label: 'под ширину страницы' },
  { value: '1280', label: '1280 × 896' },
  { value: '1920', label: '1920 × 1344' },
  { value: '2560', label: '2560 × 1792' },
];

const PATTERNS = [
  { value: 'noise-bw', label: 'Случайные точки, ч/б' },
  { value: 'noise-color', label: 'Случайные точки, цветные' },
  { value: 'image', label: 'Своя картинка узором' },
  // Стерео на точках, фотография — подложкой поверх готового кадра
  // (docs/adr/005): узором фотография видна только полосой шириной в
  // период, подложкой — целиком.
  { value: 'overlay', label: 'Фото подложкой + точки' },
];

// Как из картинки берётся полоса узора (docs/api_contracts.md, п.3).
// Полоса всегда шириной в период узора, режим меняет только выборку.
const PATTERN_MODES = [
  { value: 'strip', label: 'Полоса от левого края' },
  { value: 'drift', label: 'Полоса со сдвигом по строкам' },
  { value: 'squeeze', label: 'Вся картинка, сжатая по ширине' },
];

const SLIDERS = [
  {
    name: 'eyeSeparation',
    label: 'E — межзрачковое расстояние, px',
    min: 60,
    // Период узора на фоне — round(E/2). Свести параллельным взглядом
    // можно, пока период не больше расстояния между зрачками (~63 мм,
    // это ~238 px при 96 dpi), то есть примерно до E=476. Ползунок
    // остановлен на 400 (период ~53 мм): дальше сводить уже мучительно,
    // а в строке статуса период показан в миллиметрах.
    max: 400,
    step: 10,
    value: 180,
    format: (v) => String(v),
  },
  {
    name: 'depthStrength',
    label: 'μ — сила рельефа',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    value: 0.45,
    format: (v) => v.toFixed(2),
  },
  {
    name: 'blur',
    label: 'Размытие карты глубины, px',
    min: 0,
    max: 6,
    step: 1,
    value: 2,
    format: (v) => String(v),
  },
  {
    name: 'floor',
    label: 'Подъём модели над фоном',
    min: 0,
    max: 0.6,
    step: 0.05,
    value: 0.35,
    format: (v) => v.toFixed(2),
  },
  // Ручки узора стоят последними: к глубине отношения не имеют.
  {
    name: 'driftPerRow',
    label: 'Сдвиг полосы на строку, px',
    min: 0,
    max: 3,
    step: 0.1,
    value: 0.7,
    format: (v) => v.toFixed(1),
  },
  {
    name: 'overlayAmount',
    label: 'Сила фото-подложки',
    min: 0,
    max: 1,
    step: 0.05,
    value: 0.6,
    format: (v) => v.toFixed(2),
  },
  {
    name: 'overlayBlur',
    label: 'Размытие подложки, px',
    min: 0,
    max: 48,
    step: 4,
    // Замер показал, что машинному сопоставлению радиус безразличен
    // (docs/adr/005): он торгует детали фотографии против собственного
    // шума точек, а это дело глаза. 8 px — осторожная середина.
    value: 8,
    format: (v) => String(v),
  },
];

function labelled(text, control) {
  const label = document.createElement('label');
  // У флажка подпись читается справа от него, у остальных контролов —
  // сверху, поэтому порядок зависит от типа.
  const parts =
    control.type === 'checkbox'
      ? [control, document.createTextNode(` ${text}`)]
      : [document.createTextNode(text), control];
  label.append(...parts);
  return label;
}

export function createControls() {
  const root = document.createElement('div');
  root.className = 'controls';

  const model = document.createElement('select');
  for (const { value, label } of MODELS) {
    model.add(new Option(label, value));
  }
  // Пункт появляется только когда пользователь принёс свой файл: выбрать
  // его из списка нельзя, пока файла нет.
  const loadedOption = new Option('Загруженная модель', 'loaded');
  loadedOption.hidden = true;
  model.add(loadedOption);

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.glb,.gltf,model/gltf-binary';

  const resolution = document.createElement('select');
  for (const { value, label } of RESOLUTIONS) {
    resolution.add(new Option(label, value));
  }

  const pattern = document.createElement('select');
  for (const { value, label } of PATTERNS) {
    pattern.add(new Option(label, value));
  }

  const texture = document.createElement('input');
  texture.type = 'file';
  texture.accept = 'image/*';

  const patternMode = document.createElement('select');
  for (const { value, label } of PATTERN_MODES) {
    patternMode.add(new Option(label, value));
  }

  const mirror = document.createElement('input');
  mirror.type = 'checkbox';

  const crossEyed = document.createElement('input');
  crossEyed.type = 'checkbox';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Скачать PNG';

  const sliders = new Map();
  const outputs = new Map();

  root.append(
    labelled('Модель', model),
    labelled('Свой файл .glb', file),
    labelled('Разрешение выхода', resolution),
    labelled('Узор', pattern),
    labelled('Картинка для узора', texture),
    labelled('Как ложится картинка', patternMode),
    labelled('Отражать полосу (без шва)', mirror),
  );

  for (const slider of SLIDERS) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(slider.min);
    input.max = String(slider.max);
    input.step = String(slider.step);
    input.value = String(slider.value);

    const output = document.createElement('output');
    const label = document.createElement('label');
    label.append(document.createTextNode(`${slider.label}: `), output, input);
    root.append(label);

    sliders.set(slider.name, input);
    outputs.set(slider.name, { output, format: slider.format });
  }

  root.append(labelled('Перекрёстный взгляд', crossEyed), exportButton);

  // Ручки узора-картинки не имеют смысла при шуме, а сдвиг — вне режима
  // 'drift'. Заблокированный контрол честнее спрятанного: панель не
  // перестраивается на каждый выбор, и видно, что ручка вообще есть.
  function syncAvailability() {
    const image = pattern.value === 'image';
    const overlay = pattern.value === 'overlay';
    const enabled = new Map([
      // Картинка нужна и узором, и подложкой.
      [texture, image || overlay],
      [patternMode, image],
      [mirror, image],
      [sliders.get('driftPerRow'), image && patternMode.value === 'drift'],
      [sliders.get('overlayAmount'), overlay],
      [sliders.get('overlayBlur'), overlay],
    ]);
    for (const [control, on] of enabled) {
      control.disabled = !on;
      control.closest('label').classList.toggle('off', !on);
    }
  }

  for (const control of [pattern, patternMode]) {
    control.addEventListener('input', syncAvailability);
  }
  syncAvailability();

  function read() {
    const values = {
      model: model.value,
      resolution: resolution.value,
      pattern: pattern.value,
      patternMode: patternMode.value,
      mirror: mirror.checked,
      crossEyed: crossEyed.checked,
    };
    for (const [name, input] of sliders) {
      values[name] = Number(input.value);
    }
    return values;
  }

  function showValues(values) {
    for (const [name, { output, format }] of outputs) {
      output.textContent = format(values[name]);
    }
  }

  return {
    root,
    read,
    showValues,
    setModel(value) {
      model.value = value;
    },
    onModelChange(handler) {
      model.addEventListener('change', () => handler(model.value));
    },
    onFile(handler) {
      file.addEventListener('change', () => {
        const [chosen] = file.files;
        if (chosen) handler(chosen);
      });
    },
    onTexture(handler) {
      texture.addEventListener('change', () => {
        const [chosen] = texture.files;
        if (chosen) handler(chosen);
      });
    },
    setPattern(value) {
      // Пользователь уже выбрал, как использовать картинку — не
      // перебивать его выбор при загрузке файла.
      if (pattern.value !== 'overlay') pattern.value = value;
      syncAvailability();
    },
    onInput(handler) {
      const extra = [resolution, pattern, patternMode, mirror, crossEyed];
      for (const input of [...sliders.values(), ...extra]) {
        input.addEventListener('input', handler);
      }
    },
    onExport(handler) {
      exportButton.addEventListener('click', handler);
    },
    setBusy(busy) {
      exportButton.disabled = busy;
    },
  };
}
