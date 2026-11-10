// High-school exercises dictated in several spoken variants (Italian and English),
// plus generated families. Each must give the right value and the expected LaTeX.
const M = require('../math-speech.js');
const B = String.fromCharCode(92);
const tex = (s) => s.replace(/@/g, B);          // write LaTeX with @ instead of backslash
const log = (b, x) => Math.log(x) / Math.log(b);
const rad = (d) => d * Math.PI / 180;

// [genre, expected value, expected LaTeX, Italian variants[], English variants[]]
const CASES = [
  // ---------------------------------------------------------------- 1. Fractions
  ['7/12 + 5/18 − 1/9', 7 / 12 + 5 / 18 - 1 / 9, '@frac{7}{12} + @frac{5}{18} - @frac{1}{9}',
    ['7 dodicesimi più 5 diciottesimi meno 1 nono', 'sette dodicesimi più cinque diciottesimi meno un nono', '7 fratto 12 più 5 fratto 18 meno 1 fratto 9'],
    ['7 twelfths plus 5 eighteenths minus 1 ninth', '7 over 12 plus 5 over 18 minus 1 over 9']],
  ['4/5 · 15/8 + 2/3', 4 / 5 * 15 / 8 + 2 / 3, '@frac{4}{5} @cdot @frac{15}{8} + @frac{2}{3}',
    ['4 quinti per 15 ottavi più 2 terzi', '4 fratto 5 per 15 fratto 8 più 2 fratto 3'],
    ['4 fifths times 15 eighths plus 2 thirds', '4 over 5 times 15 over 8 plus 2 over 3']],
  ['9/10 : 3/4 − 1/5', 9 / 10 / (3 / 4) - 1 / 5, '@frac{9}{10} : @frac{3}{4} - @frac{1}{5}',
    ['9 decimi diviso 3 quarti meno 1 quinto', '9 fratto 10 diviso 3 fratto 4 meno 1 fratto 5'],
    ['9 tenths divided by 3 quarters minus 1 fifth', '9 over 10 divided by 3 over 4 minus 1 over 5']],
  ['2/7 + 3/5 · 10/9', 2 / 7 + 3 / 5 * 10 / 9, '@frac{2}{7} + @frac{3}{5} @cdot @frac{10}{9}',
    ['2 settimi più 3 quinti per 10 noni', '2 fratto 7 più 3 fratto 5 per 10 fratto 9'],
    ['2 sevenths plus 3 fifths times 10 ninths']],
  ['(5/6 − 1/4) · 12/7', (5 / 6 - 1 / 4) * 12 / 7, '@left(@frac{5}{6} - @frac{1}{4}@right) @cdot @frac{12}{7}',
    ['aperta parentesi 5 sesti meno 1 quarto chiusa parentesi per 12 settimi', 'aperta parentesi 5 fratto 6 meno 1 fratto 4 chiusa parentesi per 12 fratto 7'],
    ['open parenthesis 5 sixths minus 1 quarter close parenthesis times 12 sevenths']],

  // ---------------------------------------------------------------- 2. Roots and powers
  ['√196 + √225 − √64', 14 + 15 - 8, '@sqrt{196} + @sqrt{225} - @sqrt{64}',
    ['radice di 196 più radice di 225 meno radice di 64', 'radice quadrata di 196 più radice quadrata di 225 meno radice quadrata di 64'],
    ['square root of 196 plus square root of 225 minus square root of 64']],
  ['√12 · √27', 18, '@sqrt{12} @cdot @sqrt{27}',
    ['radice di 12 per radice di 27'], ['square root of 12 times square root of 27']],
  ['√200 / √8', 5, '@frac{@sqrt{200}}{@sqrt{8}}',
    ['radice di 200 fratto radice di 8', 'radice di 200 diviso radice di 8'], ['square root of 200 over square root of 8']],
  ['5³ − 3⁴ + 2⁶', 125 - 81 + 64, '5^{3} - 3^{4} + 2^{6}',
    ['5 alla terza meno 3 alla quarta più 2 alla sesta', '5 al cubo meno 3 alla quarta più 2 alla sesta', '5 elevato alla 3 meno 3 elevato alla 4 più 2 elevato alla 6'],
    ['5 cubed minus 3 to the fourth plus 2 to the sixth', '5 to the power of 3 minus 3 to the power of 4 plus 2 to the power of 6']],
  ['∛512 + ∛343', 15, '@sqrt[3]{512} + @sqrt[3]{343}',
    ['radice cubica di 512 più radice cubica di 343'], ['cube root of 512 plus cube root of 343']],

  // ---------------------------------------------------------------- 3. Logarithms
  ['log₂128 − log₃9', 7 - 2, '@log_{2} 128 - @log_{3} 9',
    ['logaritmo in base 2 di 128 meno logaritmo in base 3 di 9', 'log in base 2 di 128 meno log in base 3 di 9', 'logaritmo di 128 in base 2 meno logaritmo di 9 in base 3'],
    ['log base 2 of 128 minus log base 3 of 9', 'log of 128 base 2 minus log of 9 base 3']],
  ['log₅125 + log₄64', 6, '@log_{5} 125 + @log_{4} 64',
    ['logaritmo in base 5 di 125 più logaritmo in base 4 di 64'], ['log base 5 of 125 plus log base 4 of 64']],
  ['log₂8 · log₃27', 9, '@log_{2} 8 @cdot @log_{3} 27',
    ['logaritmo in base 2 di 8 per logaritmo in base 3 di 27'], ['log base 2 of 8 times log base 3 of 27']],
  ['log₁₀0.01 + log₂16', 2, '',
    ['logaritmo in base 10 di 0,01 più logaritmo in base 2 di 16', 'logaritmo in base 10 di zero virgola zero uno più logaritmo in base 2 di 16', 'logaritmo di 0,01 più logaritmo in base 2 di 16'],
    ['log base 10 of 0.01 plus log base 2 of 16', 'log of zero point zero one plus log base 2 of 16']],
  ['log₃81 − 2·log₂4', 0, '@log_{3} 81 - 2@,@log_{2} 4',
    ['logaritmo in base 3 di 81 meno 2 logaritmo in base 2 di 4'],
    ['log base 3 of 81 minus 2 log base 2 of 4']],

  // ---------------------------------------------------------------- 4. Mixed expressions
  ['(3³ + √169) / 2³', 5, '@frac{3^{3} + @sqrt{169}}{2^{3}}',
    ['numeratore 3 alla terza più radice di 169 denominatore 2 alla terza', '3 alla terza più radice di 169 tutto fratto 2 alla terza'],
    ['numerator 3 cubed plus square root of 169 denominator 2 cubed', '3 cubed plus square root of 169 all over 2 cubed']],
  ['5/3 + √144/6 − log₂8', 5 / 3 + 2 - 3, '@frac{5}{3} + @frac{@sqrt{144}}{6} - @log_{2} 8',
    ['5 terzi più radice di 144 fratto 6 meno logaritmo in base 2 di 8', '5 fratto 3 più radice di 144 fratto 6 meno logaritmo in base 2 di 8'],
    ['5 thirds plus square root of 144 over 6 minus log base 2 of 8']],
  ['(2³ − √16) · 3/4', 3, '@left(2^{3} - @sqrt{16}@right) @cdot @frac{3}{4}',
    ['aperta parentesi 2 alla terza meno radice di 16 chiusa parentesi per 3 quarti'],
    ['open parenthesis 2 cubed minus square root of 16 close parenthesis times 3 quarters']],
  ['(log₂64 + √100) / 4', 4, '@frac{@log_{2} 64 + @sqrt{100}}{4}',
    ['numeratore logaritmo in base 2 di 64 più radice di 100 denominatore 4', 'logaritmo in base 2 di 64 più radice di 100 tutto fratto 4'],
    ['numerator log base 2 of 64 plus square root of 100 denominator 4']],
  ['√81 + 3³/√9 − log₅25', 9 + 9 - 2, '@sqrt{81} + @frac{3^{3}}{@sqrt{9}} - @log_{5} 25',
    ['radice di 81 più 3 alla terza fratto radice di 9 meno logaritmo in base 5 di 25'],
    ['square root of 81 plus 3 cubed over square root of 9 minus log base 5 of 25']],

  // ---------------------------------------------------------------- 5. Trigonometry
  ['sin60° · cos30°', Math.sin(rad(60)) * Math.cos(rad(30)), '@sin 60^{@circ} @cdot @cos 30^{@circ}',
    ['seno di 60 per coseno di 30', 'seno di 60 gradi per coseno di 30 gradi'], ['sine of 60 times cosine of 30']],
  ['2 · log₂4 said with "per"', 4, '2 @cdot @log_{2} 4', ['2 per logaritmo in base 2 di 4'], ['2 times log base 2 of 4']],
  ['sin²30° + cos²30°', 1, '@sin^{2} 30^{@circ} + @cos^{2} 30^{@circ}',
    ['seno al quadrato di 30 più coseno al quadrato di 30', 'seno quadro di 30 più coseno quadro di 30'], ['sine squared of 30 plus cosine squared of 30']],
  ['tan60° · 1/√3', 1, '@tan 60^{@circ} @cdot @frac{1}{@sqrt{3}}',
    ['tangente di 60 per 1 fratto radice di 3'], ['tangent of 60 times 1 over square root of 3']],
  ['2cos60° + sin90°', 2, '2@,@cos 60^{@circ} + @sin 90^{@circ}',
    ['2 coseno di 60 più seno di 90'], ['2 cosine of 60 plus sine of 90']],
  ['8^(1/3) with a fraction in words', 2, '8^{@frac{1}{3}}', ['8 elevato a un terzo'], ['8 to the one third']],
  ['x^(n) then a fraction bar', 16 / 4, '@frac{2^{4}}{4}', ['2 alla quarta fratto 4'], ['2 to the fourth over 4']],
  ['sin45° / cos45°', 1, '@frac{@sin 45^{@circ}}{@cos 45^{@circ}}',
    ['seno di 45 fratto coseno di 45', 'seno di 45 diviso coseno di 45'], ['sine of 45 over cosine of 45']],

  // ---------------------------------------------------------------- 6. More complex
  ['(3² + √49)·2 / (log₂8 + 4)', (9 + 7) * 2 / (3 + 4), '@frac{@left(3^{2} + @sqrt{49}@right) @cdot 2}{@log_{2} 8 + 4}',
    ['numeratore aperta parentesi 3 al quadrato più radice di 49 chiusa parentesi per 2 denominatore logaritmo in base 2 di 8 più 4'],
    ['numerator open parenthesis 3 squared plus square root of 49 close parenthesis times 2 denominator log base 2 of 8 plus 4']],
  ['(3/4 + 5/6)² − 7/12', (3 / 4 + 5 / 6) ** 2 - 7 / 12, '@left(@frac{3}{4} + @frac{5}{6}@right)^{2} - @frac{7}{12}',
    ['aperta parentesi 3 quarti più 5 sesti chiusa parentesi al quadrato meno 7 dodicesimi', 'aperta parentesi 3 fratto 4 più 5 fratto 6 chiusa parentesi al quadrato meno 7 fratto 12'],
    ['open parenthesis 3 quarters plus 5 sixths close parenthesis squared minus 7 twelfths']],
  ['(√225 − √81)/2³ + log₃27', 6 / 8 + 3, '@frac{@sqrt{225} - @sqrt{81}}{2^{3}} + @log_{3} 27',
    ['numeratore radice di 225 meno radice di 81 denominatore 2 alla terza fine frazione più logaritmo in base 3 di 27'],
    ['numerator square root of 225 minus square root of 81 denominator 2 cubed end fraction plus log base 3 of 27']],
  ['2⁵·√16 / 4² + 7/3', 32 * 4 / 16 + 7 / 3, '@frac{2^{5} @cdot @sqrt{16}}{4^{2}} + @frac{7}{3}',
    ['numeratore 2 alla quinta per radice di 16 denominatore 4 al quadrato fine frazione più 7 terzi'],
    ['numerator 2 to the fifth times square root of 16 denominator 4 squared end fraction plus 7 thirds']],
  ['[log₂32 + √64] · (3/5)²', (5 + 8) * (3 / 5) ** 2, '@left(@log_{2} 32 + @sqrt{64}@right) @cdot @left(@frac{3}{5}@right)^{2}',
    ['aperta parentesi quadra logaritmo in base 2 di 32 più radice di 64 chiusa parentesi quadra per aperta parentesi 3 quinti chiusa parentesi al quadrato'],
    ['open square bracket log base 2 of 32 plus square root of 64 close square bracket times open parenthesis 3 fifths close parenthesis squared']],
];

let ok = 0, total = 0;
const fails = [];
for (const [genre, value, latexWant, itList, enList] of CASES) {
  for (const [lang, list] of [['it', itList], ['en', enList]]) {
    M.setLanguage(lang);
    for (const s of list) {
      total++;
      const r = M.find(s);
      const want = lang === 'en' ? tex(latexWant).replace(/ : /g, ' ' + B + 'div ') : tex(latexWant);
      // the Italian formula writes decimals with a comma; only check LaTeX when one is given
      const valOk = !!r && Math.abs(r.value - value) < 1e-9 * Math.max(1, Math.abs(value));
      const texOk = !latexWant || (!!r && r.latex === want);
      if (valOk && texOk) ok++;
      else fails.push(`FAIL [${genre}] ${lang}: "${s}"\n     got ${r ? r.value + '   ' + r.latex : '—'}\n    want ${value}   ${want}`);
    }
  }
}
// ------------------------------------------------------------------------------
// Generated families: every combination of numbers within each genre
// ------------------------------------------------------------------------------
const IT_CARD = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici',
  'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti', 'ventuno', 'ventidue', 'ventitre',
  'ventiquattro', 'venticinque', 'ventisei', 'ventisette', 'ventotto', 'ventinove', 'trenta', 'trentuno', 'trentadue',
  'trentatre', 'trentaquattro', 'trentacinque', 'trentasei'];
const IT_DEN = { 2: 'mezzi', 3: 'terzi', 4: 'quarti', 5: 'quinti', 6: 'sesti', 7: 'settimi', 8: 'ottavi', 9: 'noni', 10: 'decimi' };
const itDen = (d) => IT_DEN[d] || (/(tre|sei)$/.test(IT_CARD[d]) ? IT_CARD[d] + 'esimi' : IT_CARD[d].slice(0, -1) + 'esimi');
const IT_ORD_F = { 2: 'seconda', 3: 'terza', 4: 'quarta', 5: 'quinta', 6: 'sesta', 7: 'settima', 8: 'ottava', 9: 'nona', 10: 'decima' };
const EN_CARD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const EN_DEN = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 12: 'twelfths', 20: 'twentieths' };
const enDen = (d) => EN_DEN[d] || EN_CARD[d] + 'ths';
const EN_ORD = { 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth' };
const IT_ROOT = { 2: 'quadrata', 3: 'cubica', 4: 'quarta', 5: 'quinta', 6: 'sesta' };
const EN_ROOT = { 2: 'square', 3: 'cube', 4: 'fourth', 5: 'fifth', 6: 'sixth' };

const gen = [];   // [family, lang, sentence, value]
for (let d = 2; d <= 36; d++) {
  gen.push(['fraction in words', 'it', `3 ${itDen(d)} più 1 ${itDen(d)}`, 4 / d]);
  gen.push(['fraction with fratto', 'it', `5 fratto ${d} per ${d} fratto 5`, 1]);
  if (d <= 20) gen.push(['fraction in words', 'en', `3 ${enDen(d)} plus 1 ${enDen(d)}`, 4 / d]);
}
for (let b = 2; b <= 9; b++) for (let e = 2; e <= 10; e++) {
  gen.push(['power', 'it', `${b} alla ${IT_ORD_F[e]} meno 1`, b ** e - 1]);
  gen.push(['power', 'it', `${b} elevato alla ${e} fratto ${b}`, b ** e / b]);
  gen.push(['power', 'en', `${b} to the ${EN_ORD[e]} minus 1`, b ** e - 1]);
}
for (let n = 2; n <= 6; n++) for (const x of [2, 3, 5]) {
  gen.push(['root', 'it', `radice ${IT_ROOT[n]} di ${x ** n} più 1`, x + 1]);
  gen.push(['root', 'en', `${EN_ROOT[n]} root of ${x ** n} plus 1`, x + 1]);
}
for (let b = 2; b <= 10; b++) for (const k of [2, 3]) {
  gen.push(['log base before', 'it', `logaritmo in base ${b} di ${b ** k} più 1`, k + 1]);
  gen.push(['log base after', 'it', `logaritmo di ${b ** k} in base ${b} per 2`, 2 * k]);
  gen.push(['log base before', 'en', `log base ${b} of ${b ** k} plus 1`, k + 1]);
  gen.push(['log base after', 'en', `log of ${b ** k} base ${b} times 2`, 2 * k]);
}
for (const a of [0, 30, 45, 60, 90, 120, 135, 150, 180]) {
  gen.push(['sine', 'it', `seno di ${a} più 1`, Math.sin(rad(a)) + 1]);
  gen.push(['cosine', 'it', `coseno di ${a} per 2`, 2 * Math.cos(rad(a))]);
  gen.push(['sine', 'en', `sine of ${a} plus 1`, Math.sin(rad(a)) + 1]);
  if (a !== 90) gen.push(['tangent', 'en', `tangent of ${a} times 3`, 3 * Math.tan(rad(a))]);
}
const genFails = {};
let genOk = 0;
for (const [family, lang, s, value] of gen) {
  M.setLanguage(lang);
  const r = M.find(s);
  if (r && Math.abs(r.value - value) < 1e-9 * Math.max(1, Math.abs(value))) genOk++;
  else (genFails[family + ' (' + lang + ')'] = genFails[family + ' (' + lang + ')'] || []).push(`"${s}" -> ${r ? r.value : '—'} (want ${value})`);
}
ok += genOk; total += gen.length;
for (const [family, list] of Object.entries(genFails)) {
  fails.push(`FAIL family ${family}: ${list.length} cases, e.g.\n     ${list.slice(0, 3).join('\n     ')}`);
}
console.log(`generated families: ${genOk}/${gen.length}`);

for (const f of fails) console.log(f);
console.log(`\n${ok}/${total} textbook dictations passed`);
process.exitCode = ok === total ? 0 : 1;
