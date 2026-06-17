/**
 * Minimal Code 128-B encoder → inline SVG. No external library or CDN, so
 * printed labels work fully offline / inside the Windows .exe.
 *
 * Code 128-B covers all printable ASCII (space..~). We don't auto-switch to
 * Code C for digit-pairs — B is universal and scans reliably for the short
 * SKU/EAN-style codes used here. Output is `<rect>` bars sized in modules.
 */

// 107 bar/space width patterns (indices 0..106). Each digit is a module
// width; patterns start with a bar and alternate. Index 106 = Stop.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/** Encode a string as Code 128-B and return the ordered list of module widths. */
function encodeWidths(input: string): number[] {
  const values: number[] = [START_B];
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    // Code B value space(32)=0 .. ~(126)=94. Clamp out-of-range to '?'.
    const v = code >= 32 && code <= 126 ? code - 32 : '?'.charCodeAt(0) - 32;
    values.push(v);
  }
  // Modulo-103 checksum weighted by position (start = position 0).
  let sum = START_B;
  values.slice(1).forEach((v, i) => {
    sum += v * (i + 1);
  });
  values.push(sum % 103);
  values.push(STOP);

  const widths: number[] = [];
  for (const v of values) {
    for (const d of PATTERNS[v]) widths.push(Number(d));
  }
  return widths;
}

interface Code128SvgOpts {
  /** Module (narrowest bar) width in px. */
  moduleWidth?: number;
  /** Bar height in px. */
  height?: number;
  color?: string;
}

/**
 * Render `value` as a self-contained Code 128-B `<svg>` string.
 * The widths alternate bar/space starting with a bar.
 */
export function code128Svg(value: string, opts: Code128SvgOpts = {}): string {
  const mw = opts.moduleWidth ?? 1.6;
  const height = opts.height ?? 56;
  const color = opts.color ?? '#000';
  const widths = encodeWidths(value);

  let x = 0;
  let isBar = true;
  const rects: string[] = [];
  for (const w of widths) {
    const px = w * mw;
    if (isBar) {
      rects.push(
        `<rect x="${x.toFixed(2)}" y="0" width="${px.toFixed(2)}" height="${height}" fill="${color}"/>`,
      );
    }
    x += px;
    isBar = !isBar;
  }
  const totalW = x.toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" ` +
    `viewBox="0 0 ${totalW} ${height}" preserveAspectRatio="none">${rects.join('')}</svg>`
  );
}
