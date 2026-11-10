// Parser unit tests (English and Italian).
const M = require('../math-speech.js');

let ok = 0, total = 0;
function check(pass, label) {
  total++; if (pass) ok++;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}`);
}
const close = (a, b) => Math.abs(a - b) < 1e-9;

function valueSuite(name, cases) {
  console.log(`\n== ${name}: values ==`);
  for (const [sentence, expected] of cases) {
    const r = M.find(sentence);
    const v = r ? r.value : null;
    const pass = expected === null ? v === null : v !== null && close(v, expected);
    const fr = r && M.fraction(r.value);
    check(pass, `${sentence.padEnd(56)} -> ${r ? r.text + ' = ' + M.format(r.value) + (fr ? '  (' + fr.text + ')' : '') : '—'}`);
  }
}
function latexSuite(name, cases) {
  console.log(`\n== ${name}: notation ==`);
  for (const [sentence, expected] of cases) {
    const r = M.find(sentence);
    check(!!r && r.latex === expected, `${sentence.padEnd(56)} -> ${r ? r.latex : '—'}`);
  }
}
function partialSuite(name, cases) {
  console.log(`\n== ${name}: unfinished input ==`);
  for (const [sentence, complete, txt] of cases) {
    const r = M.find(sentence, { partial: true });
    const pass = complete === null ? r === null : !!r && r.complete === complete && r.text === txt;
    check(pass, `${sentence.padEnd(56)} -> ${r ? r.text + (r.complete ? '' : '  (incomplete)') : '—'}`);
  }
}

// ---------------------------------------------------------------- English
M.setLanguage('en');
valueSuite('English', [
  ['5 times 3', 15],
  ['5x3', 15],
  ['7 × 4', 28],
  ['19 * 2', 38],
  ['nineteen times two', 38],
  ['so let me see 19 times 2', 38],
  ['what is 12 divided by 4', 3],
  ['3 over 4', 0.75],
  ['three quarters plus one sixth', 3 / 4 + 1 / 6],
  ['a third plus a half', 1 / 3 + 1 / 2],
  ['2 to the third', 8],
  ['2 to the power of 5', 32],
  ['2 raised to the fifth power', 32],
  ['9 squared', 81],
  ['3 cubed', 27],
  ['the square root of 144', 12],
  ['square root of 2', Math.SQRT2],
  ['cube root of 27', 3],
  ['20% of 50', 10],
  ['twenty percent of eighty', 16],
  ['3.5 times 2', 7],
  ['three point five times two', 7],
  ['three and a half times two', 7],
  ['1,000 divided by 8', 125],
  ['one hundred twenty divided by three', 40],
  ['a hundred and twenty divided by three', 40],
  ['two thousand five hundred minus 500', 2000],
  ['twenty-three plus seventeen', 40],
  ['minus 5 times 3', -15],
  ['negative 5 plus 8', 3],
  ['8 - 3', 5],
  ['open parenthesis 2 plus 3 close parenthesis times 4', 20],
  ['(2+3)*4', 20],
  ['2 plus 3 times 4', 14],
  ['10 divided by 4', 2.5],
  ['3 million divided by 3', 1e6],
  ['4 times 2 divided by 3 plus 53', 4 * 2 / 3 + 53],
  ['four times two divided by three plus fifty three', 4 * 2 / 3 + 53],
  ['12 plus 3 times 4 minus 6 divided by 2 plus 1', 22],
  ['2 to the fifth minus the square root of 144', 20],
  ['square root of 9 plus 16 end root', 5],
  ['square root of 9 plus 16 end root times 2', 10],
  ['square root of open parenthesis 9 plus 16 close parenthesis', 5],
  ['square root of the quantity 9 plus 16', 5],
  ['log of 1000', 3],
  ['natural log of 1', 0],
  ['log base 2 of 8', 3],
  ['sine of 30', 0.5],
  ['cosine of pi', -1],
  ['tangent of 45', 1],
  ['2 pi times 3', 6 * Math.PI],
  ['5 factorial', 120],
  ['absolute value of minus 7', 7],
  ['3 plus 5 all over 2', 4],
  ['3 plus 5 all squared', 64],
  ['open square bracket 2 plus 3 close square bracket times 4', 20],
  ['I am studying physics today', null],
  ['page 5', null],
  ['times up', null],
]);
latexSuite('English', [
  ['4 times 2 divided by 3 plus 53', String.raw`\frac{4 \cdot 2}{3} + 53`],
  ['three quarters plus one sixth', String.raw`\frac{3}{4} + \frac{1}{6}`],
  ['open parenthesis 2 plus 3 close parenthesis divided by 5', String.raw`\frac{2 + 3}{5}`],
  ['square root of 2 plus 7', String.raw`\sqrt{2} + 7`],
  ['2 to the third times 5', String.raw`2^{3} \cdot 5`],
  ['3.5 times 2', String.raw`3.5 \cdot 2`],
  ['1,500 plus 1', String.raw`1{,}500 + 1`],
  ['square root of 9 plus 16 end root', String.raw`\sqrt{9 + 16}`],
  ['log base 2 of 8', String.raw`\log_{2} 8`],
  ['sine of 30', String.raw`\sin 30^{\circ}`],
  ['3 plus 5 all over 2', String.raw`\frac{3 + 5}{2}`],
  ['5 factorial', String.raw`5!`],
  ['square root of open parenthesis 3 plus 1 close parenthesis cubed', String.raw`\sqrt{\left(3 + 1\right)^{3}}`],
  ['square root of 2 plus 1 end root squared', String.raw`\left(\sqrt{2 + 1}\right)^{2}`],
  ['log of 8 squared', String.raw`\log\left(8^{2}\right)`],
]);
partialSuite('English', [
  ['4 times 2 divided by', false, '4 × 2 ÷ □'],
  ['4 times 2 divided by 3 plus', false, '4 × 2 ÷ 3 + □'],
  ['4 times 2 divided by 3 plus 53', true, '4 × 2 ÷ 3 + 53'],
  ['open parenthesis 2 plus 3', true, '(2 + 3'],   // left open: closed automatically at the end
  ['square root of', false, '√□'],
  ['square root of open parenthesis 9 plus 16', true, '√(9 + 16'],
  ['log base 2 of', false, 'log_2(□)'],
  ['studying today', null, null],
]);

console.log('\n== English: previous result ==');
for (const [s, ans, exp] of [['times 3', 12, 36], ['previous answer divided by 4', 12, 3], ['plus 1', 41, 42], ['please', 12, null]]) {
  const r = M.find(s, { ans });
  check(exp === null ? r === null : !!r && close(r.value, exp), `${s.padEnd(56)} (ans ${ans}) -> ${r ? r.text + ' = ' + M.format(r.value) : '—'}`);
}

// ---------------------------------------------------------------- Italian
M.setLanguage('it');
valueSuite('Italian', [
  ['5 per 3', 15],
  ['5x3', 15],
  ['diciannove per due', 38],
  ['allora vediamo 19 per 2', 38],
  ['quanto fa 12 diviso 4', 3],
  ['3 fratto 4', 0.75],
  ['tre quarti più un sesto', 3 / 4 + 1 / 6],
  ['2 alla terza', 8],
  ['2 elevato alla quinta', 32],
  ['9 al quadrato', 81],
  ['3 al cubo', 27],
  ['radice quadrata di 144', 12],
  ['radice cubica di 27', 3],
  ['20% di 50', 10],
  ['venti per cento di 80', 16],
  ['3,5 per 2', 7],
  ['tre virgola cinque per due', 7],
  ['tre e mezzo per due', 7],
  ['1.000 diviso 8', 125],
  ['centoventi diviso tre', 40],
  ['cento venti diviso tre', 40],
  ['duemilacinquecento meno 500', 2000],
  ['ventitré più diciassette', 40],
  ['centotto per due', 216],
  ['meno 5 per 3', -15],
  ['8-3', 5],
  ['aperta parentesi 2 più 3 chiusa parentesi per 4', 20],
  ['2 più 3 per 4', 14],
  ['10 diviso per 4', 2.5],
  ['sei volte sette', 42],
  ['3 milioni diviso 3', 1e6],
  ['4 per 2 diviso 3 più 53', 4 * 2 / 3 + 53],
  ['quattro per due diviso tre più cinquantatré', 4 * 2 / 3 + 53],
  ['2 alla terza più radice di 16 per 3 meno 1', 19],
  ['radice di 9 più 16 chiusa radice', 5],
  ['radice di 9 più 16 chiusa radice per 2', 10],
  ['radice quadrata di apri la parentesi tonda 9 più 16 chiudi la parentesi tonda', 5],
  ['logaritmo di 1000', 3],
  ['logaritmo naturale di 1', 0],
  ['logaritmo in base 2 di 8', 3],
  ['seno di 30', 0.5],
  ['coseno di pi greco', -1],
  ['2 pi greco per 3', 6 * Math.PI],
  ['5 fattoriale', 120],
  ['valore assoluto di meno 7', 7],
  ['3 più 5 tutto fratto 2', 4],
  ['3 più 5 il tutto al quadrato', 64],
  ['radice quadrata, aperta parentesi, 3 più 1, chiusa parentesi, alla terza', 8],
  ['oggi studio fisica', null],
  ['pagina 5', null],
  ['per favore', null],
]);
latexSuite('Italian', [
  ['4 per 2 diviso 3 più 53', String.raw`\frac{4 \cdot 2}{3} + 53`],
  ['tre quarti più un sesto', String.raw`\frac{3}{4} + \frac{1}{6}`],
  ['radice di 2 più 7', String.raw`\sqrt{2} + 7`],
  ['3,5 per 2', String.raw`3{,}5 \cdot 2`],
  ['radice quadrata, aperta parentesi, 3 più 1, chiusa parentesi, alla terza', String.raw`\sqrt{\left(3 + 1\right)^{3}}`],
  ['radice aperta parentesi 2 più 1 chiusa parentesi alla seconda', String.raw`\sqrt{\left(2 + 1\right)^{2}}`],
  ['radice di 2 più 1 chiusa radice alla seconda', String.raw`\left(\sqrt{2 + 1}\right)^{2}`],
  ['radice di 2 al quadrato', String.raw`\sqrt{2^{2}}`],
  ['radice di aperta parentesi 3 più 1 alla terza chiusa parentesi', String.raw`\sqrt{3 + 1^{3}}`],
]);
partialSuite('Italian', [
  ['4 per 2 diviso', false, '4 × 2 ÷ □'],
  ['aperta parentesi 2 più 3', true, '(2 + 3'],
  ['radice di', false, '√□'],
  ['oggi studio', null, null],
]);

console.log('\n== Italian: previous result ==');
for (const [s, ans, exp] of [['per 3', 12, 36], ['risultato precedente diviso 4', 12, 3], ['per favore', 12, null]]) {
  const r = M.find(s, { ans });
  check(exp === null ? r === null : !!r && close(r.value, exp), `${s.padEnd(56)} (ans ${ans}) -> ${r ? r.text + ' = ' + M.format(r.value) : '—'}`);
}

console.log('\n== Italian: is the calculation the last thing said? ==');
for (const [s, atEnd] of [['4 per 2 diviso 3', true], ['4 per 2 diviso 3 poi passiamo al prossimo esercizio', false],
  ['4 per 2 diviso', true], ['4 per 2 diviso tr', false]]) {
  const r = M.find(s, { partial: true });
  check(!!r && r.atEnd === atEnd, `${s.padEnd(56)} -> atEnd ${r && r.atEnd}`);
}


M.setLanguage('it');
console.log('\n== Italian: high-school cases (value and formula) ==');
for (const [s, val, tex] of [
  ["10 alla meno 3", 0.001, String.raw`10^{-3}`],
  ["1,6 per 10 alla meno 19", 1.6e-19, String.raw`1{,}6 \cdot 10^{-19}`],
  ["2 elevato alla meno 2", 0.25, String.raw`2^{-2}`],
  ["10⁻³", 0.001, String.raw`10^{-3}`],
  ["5²", 25, String.raw`5^{2}`],
  ["3·4", 12, String.raw`3 \cdot 4`],
  ["tre virgola zero cinque per due", 6.1, String.raw`3{,}05 \cdot 2`],
  ["zero virgola cinque per 4", 2, String.raw`0{,}5 \cdot 4`],
  ["logaritmo di 8 in base 2", 3, String.raw`\log_{2} 8`],
  ["logaritmo in base 3 di 81", 4, String.raw`\log_{3} 81`],
  ["log di 100 in base 10 più 1", 3, String.raw`\log_{10} 100 + 1`],
  ["logaritmo di 2 più 6 fine logaritmo", 0.9030899869919435, String.raw`\log\left(2 + 6\right)`],
  ["logaritmo di 2 per 50 chiuso logaritmo per 3", 6, String.raw`\log\left(2 \cdot 50\right) \cdot 3`],
  ["radice quarta di 16", 2, String.raw`\sqrt[4]{16}`],
  ["radice quinta di 32", 2, String.raw`\sqrt[5]{32}`],
  ["radice cubica di meno 8", -2, String.raw`\sqrt[3]{-8}`],
  ["radice di 9 più 16 chiusa radice", 5, String.raw`\sqrt{9 + 16}`],
  ["radice di 9 più 16", 19, String.raw`\sqrt{9} + 16`],
  ["due terzi di 60", 40, String.raw`\frac{2}{3} \cdot 60`],
  ["la metà di 80", 40, String.raw`\frac{1}{2} \cdot 80`],
  ["frazione con numeratore 3 più 5 e denominatore 2 più 2", 2, String.raw`\frac{3 + 5}{2 + 2}`],
  ["numeratore 1 denominatore 2 più 3 fine frazione per 5", 1, String.raw`\frac{1}{2 + 3} \cdot 5`],
  ["3 più 5 tutto fratto 2 più 2", 6, ''],
  ["2 elevato a 3 più 1 fine esponente", 16, String.raw`2^{3 + 1}`],
  ["2 elevato a 3 più 1", 9, String.raw`2^{3} + 1`],
  ["1 fratto 2 pi greco", 0.15915494309189535, String.raw`\frac{1}{2\pi}`],
  ["1 fratto 2 radice di 3", 0.2886751345948129, String.raw`\frac{1}{2\sqrt{3}}`],
  ["2 pi greco per 3", 18.84955592153876, String.raw`2\pi \cdot 3`],
  ["4 fratto 2 per 3", 6, String.raw`\frac{4}{2} \cdot 3`],
  ["seno di 30 più 60 fine seno", 1, ''],
  ["seno al quadrato di 30", 0.25, String.raw`\sin^{2} 30^{\circ}`],
  ["seno di 30 gradi", 0.5, String.raw`\sin 30^{\circ}`],
  ["seno di 2 radianti", 0.9092974268256817, String.raw`\sin 2\,\text{rad}`],
  ["seno di pi greco fratto 6", 0.5, ''],
  ["seno di pi greco mezzi", 1, ''],
  ["coseno di 2 pi greco terzi", -0.5, ''],
  ["seno di 30 fratto 2", 0.25, ''],
  ["radice di 2 pi greco", Math.sqrt(2 * Math.PI), ''],
  ["arcoseno di 0,5", 30, String.raw`\arcsin 0{,}5`],
  ["arcotangente di 1", 45, ''],
  ["valore assoluto di 3 meno 8 fine valore assoluto", 5, String.raw`\left|3 - 8\right|`],
  ["e alla 2", 7.3890560989306495, String.raw`e^{2}`],
  ["numero di nepero alla 2", 7.3890560989306495, String.raw`e^{2}`],
]) {
  const r = M.find(s);
  const pass = !!r && close(r.value, val) && (!tex || r.latex === tex);
  check(pass, `${s.padEnd(56)} -> ${r ? M.pretty(r.value) + '   ' + r.latex : '—'}`);
}

M.setLanguage('en');
console.log('\n== English: high-school cases (value and formula) ==');
for (const [s, val, tex] of [
  ["10 to the minus 3", 0.001, String.raw`10^{-3}`],
  ["6.02 times 10 to the 23", 6.02e+23, String.raw`6.02 \cdot 10^{23}`],
  ["log of 8 base 2", 3, String.raw`\log_{2} 8`],
  ["log of 2 plus 6 end log", 0.9030899869919435, String.raw`\log\left(2 + 6\right)`],
  ["fourth root of 16", 2, String.raw`\sqrt[4]{16}`],
  ["two thirds of 60", 40, String.raw`\frac{2}{3} \cdot 60`],
  ["half of 80", 40, String.raw`\frac{1}{2} \cdot 80`],
  ["fraction with numerator 3 plus 5 and denominator 2 plus 2", 2, String.raw`\frac{3 + 5}{2 + 2}`],
  ["2 to the power of 3 plus 1 end exponent", 16, String.raw`2^{3 + 1}`],
  ["1 over 2 pi", 0.15915494309189535, String.raw`\frac{1}{2\pi}`],
  ["sine squared of 30", 0.25, String.raw`\sin^{2} 30^{\circ}`],
  ["sine of 2 radians", 0.9092974268256817, String.raw`\sin 2\,\text{rad}`],
  ["inverse sine of 0.5", 30, String.raw`\arcsin 0.5`],
  ["e to the 2", 7.3890560989306495, String.raw`e^{2}`],
  ["sine of pi over 6", 0.5, ''],
  ["cosine of 2 pi over 3", -0.5, ''],
  ["absolute value of 3 minus 8 end absolute value", 5, String.raw`\left|3 - 8\right|`],
]) {
  const r = M.find(s);
  const pass = !!r && close(r.value, val) && (!tex || r.latex === tex);
  check(pass, `${s.padEnd(56)} -> ${r ? M.pretty(r.value) + '   ' + r.latex : '—'}`);
}


M.setLanguage('it');
console.log('\n== Italian: fraction bars and misheard sine/cosine ==');
for (const [s, val, tex] of [
  ["7 ottavi per 4 terzi", 1.1666666666666667, String.raw`\frac{7}{8} \cdot \frac{4}{3}`],
  ["sette ottavi per quattro terzi", 1.1666666666666667, String.raw`\frac{7}{8} \cdot \frac{4}{3}`],
  ["7 fratto 8 per 4 fratto 3", 1.1666666666666667, String.raw`\frac{7}{8} \cdot \frac{4}{3}`],
  ["2 per 3 fratto 4", 1.5, String.raw`2 \cdot \frac{3}{4}`],
  ["4 per 2 diviso 3 più 53", 55.666666666666664, String.raw`\frac{4 \cdot 2}{3} + 53`],
  ["8 fratto 4 fratto 2", 1, ''],
  ["2 fratto 3 al quadrato", 0.2222222222222222, String.raw`\frac{2}{3^{2}}`],
  ["3 fratto meno 4", -0.75, ''],
  ["se no di 30", 0.5, ''],
  ["segno di 30", 0.5, ''],
  ["cose no di 60", 0.5, ''],
  ["così no di 60", 0.5, ''],
  ["cos'è no di 60", 0.5, ''],
  ["tangenti di 45", 1, ''],
]) {
  const r = M.find(s);
  const pass = !!r && close(r.value, val) && (!tex || r.latex === tex);
  check(pass, `${s.padEnd(56)} -> ${r ? M.pretty(r.value) + '   ' + r.latex : '—'}`);
}

M.setLanguage('en');
console.log('\n== English: fraction bars and misheard sine/cosine ==');
for (const [s, val, tex] of [
  ["seven eighths times four thirds", 1.1666666666666667, String.raw`\frac{7}{8} \cdot \frac{4}{3}`],
  ["7 over 8 times 4 over 3", 1.1666666666666667, String.raw`\frac{7}{8} \cdot \frac{4}{3}`],
  ["sign of 30", 0.5, ''],
  ["co sign of 60", 0.5, ''],
]) {
  const r = M.find(s);
  const pass = !!r && close(r.value, val) && (!tex || r.latex === tex);
  check(pass, `${s.padEnd(56)} -> ${r ? M.pretty(r.value) + '   ' + r.latex : '—'}`);
}

console.log('\n== Italian: ordinary sentences are not sine/cosine ==');
M.setLanguage('it');
for (const [s, val] of [['se no facciamo 3 per 2', 6], ['cose no facciamo 3 per 2', 6], ['il segno più 3 per 2', 6]]) {
  const r = M.find(s);
  check(!!r && close(r.value, val), `${s.padEnd(56)} -> ${r ? r.text : '—'}`);
}

console.log('\n== Italian: several calculations, same meaning, new calculation ==');
M.setLanguage('it');
{
  const vals = (s, ans) => M.findAll(s, { ans }).map((r) => r.value);
  check(JSON.stringify(vals('5 per 3 9 meno 4')) === '[15,5]', `findAll "5 per 3 9 meno 4" -> ${JSON.stringify(vals('5 per 3 9 meno 4'))}`);
  check(JSON.stringify(vals('4 per 2 uguale per 3')) === '[8,24]', `findAll "4 per 2 uguale per 3" -> ${JSON.stringify(vals('4 per 2 uguale per 3'))}`);
  check(JSON.stringify(vals('2 pi greco per 3')).startsWith('[18.8'), `findAll "2 pi greco per 3" is one calculation`);
  check(JSON.stringify(vals('oggi studio fisica')) === '[]', 'findAll on plain speech is empty');
  const same = (a, b) => M.meaningKey(a) === M.meaningKey(b);
  check(same('quattro per due', '4x2'), 'meaningKey: "quattro per due" = "4x2"');
  check(same('otto per tre uguale', '8 × 3'), 'meaningKey: "otto per tre uguale" = "8 × 3"');
  check(!same('4 per 2', '7 per 3'), 'meaningKey: "4 per 2" != "7 per 3"');
  check(M.startsNewCalc('7 per 3') && M.startsNewCalc('radice di 2') && M.startsNewCalc('pi greco mezzi'), 'startsNewCalc: number, function, pi');
  check(!M.startsNewCalc('per 3') && !M.startsNewCalc('poi passiamo') && !M.startsNewCalc('fratto 2'), 'startsNewCalc: operator or plain speech is not new');
}

console.log(`\n${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
