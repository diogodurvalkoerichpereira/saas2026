// Gerador de código de barras Code128-B em SVG, sem dependência externa.
// Espelha o gerar-codigo.php / bar128() do legado, que imprimia a etiqueta do produto.
// Code128-B cobre ASCII 32–126 (dígitos, letras e pontuação), suficiente para o campo `codigo`.

// Padrões dos 107 símbolos (largura de barra/espaço, em módulos) + padrão de parada.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];
const START_B = 104;
const STOP = 106;

// Mantém só os caracteres imprimíveis do Code128-B; troca o resto por espaço.
export function sanitizeCode(text) {
  return String(text ?? '').split('').map((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 32 && code <= 126 ? ch : ' ';
  }).join('').trim();
}

// Devolve um SVG (string) com o código de barras Code128-B de `text`.
export function code128SVG(text, { moduleWidth = 2, height = 70, quietZone = 10 } = {}) {
  const value = sanitizeCode(text);
  if (!value) return '';
  const codes = [START_B];
  let weighted = START_B;
  for (let i = 0; i < value.length; i += 1) {
    const symbol = value.charCodeAt(i) - 32; // ASCII 32 → símbolo 0
    codes.push(symbol);
    weighted += symbol * (i + 1);
  }
  codes.push(weighted % 103); // dígito verificador
  codes.push(STOP);

  const widths = codes.map((code) => PATTERNS[code]).join('');
  let x = quietZone;
  let bars = '';
  let isBar = true; // Code128 começa sempre por barra.
  for (const digit of widths) {
    const w = Number(digit) * moduleWidth;
    if (isBar) bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`;
    x += w;
    isBar = !isBar;
  }
  const totalWidth = x + quietZone;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="Código de barras ${value}"><rect width="${totalWidth}" height="${height}" fill="#fff"/>${bars}</svg>`;
}
