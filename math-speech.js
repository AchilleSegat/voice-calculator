/*
 * math-speech.js
 * Parses spoken math (English or Italian) into an expression tree, evaluates it
 * and renders it as LaTeX or plain text. See README.md for the supported phrases.
 *
 *   MathSpeech.setLanguage('en' | 'it')
 *   MathSpeech.find(sentence, { partial, ans })  -> last calculation in the sentence, or null
 *   MathSpeech.findAll(sentence, { ans })        -> every complete calculation, in order
 *
 * find() returns { ast, value, complete, atEnd, latex, text }. With `partial` an
 * unfinished expression is accepted (missing operands become "empty" nodes).
 * `ans` is the previous result, used by "previous answer" and by sentences that
 * start with an operator.
 */
(function (root) {
  'use strict';

  let lang = 'en';
  const LOCALE = { en: 'en-US', it: 'it-IT' };
  function setLanguage(l) { lang = l === 'it' ? 'it' : 'en'; }
  function getLanguage() { return lang; }

  // ---- Italian numbers ----
  const IT_UNITS = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
    'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici',
    'diciassette', 'diciotto', 'diciannove'];
  const IT_TENS = { 20: 'venti', 30: 'trenta', 40: 'quaranta', 50: 'cinquanta',
    60: 'sessanta', 70: 'settanta', 80: 'ottanta', 90: 'novanta' };

  const IT_BELOW_100 = new Map();
  IT_UNITS.forEach((w, i) => IT_BELOW_100.set(w, i));
  for (const [d, w] of Object.entries(IT_TENS)) {
    const n = Number(d);
    IT_BELOW_100.set(w, n);
    for (let u = 1; u <= 9; u++) {
      // elision: venti + uno -> ventuno, venti + otto -> ventotto
      const base = (u === 1 || u === 8) ? w.slice(0, -1) : w;
      IT_BELOW_100.set(base + IT_UNITS[u], n + u);
    }
  }
  IT_BELOW_100.set('un', 1);
  IT_BELOW_100.set('una', 1);
  const IT_DIGIT = { zero: 0, uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9 };

  function itBelow1000(s) {
    if (IT_BELOW_100.has(s)) return IT_BELOW_100.get(s);
    const i = s.indexOf('cent');
    if (i < 0) return null;
    const left = s.slice(0, i);
    const mult = left === '' ? 1 : IT_BELOW_100.get(left);
    if (mult == null || (mult < 2 && left !== '') || mult > 9) return null;
    const rest = s.slice(i + 4);                // after "cent"
    let r;
    if (rest === 'o') r = 0;                     // "cento"
    else if (rest.startsWith('o') && IT_BELOW_100.has(rest.slice(1))) r = IT_BELOW_100.get(rest.slice(1));
    else if (IT_BELOW_100.has(rest)) r = IT_BELOW_100.get(rest);   // centotto, centottanta
    else return null;
    return mult * 100 + r;
  }

  function itNumberWord(w) {
    if (!w) return null;
    if (w === 'mille') return 1000;
    const i = w.indexOf('mila');
    if (i > 0) {
      const left = itBelow1000(w.slice(0, i));
      const rest = w.slice(i + 4);
      const right = rest === '' ? 0 : itBelow1000(rest);
      if (left == null || right == null) return null;
      return left * 1000 + right;
    }
    if (w.startsWith('mille')) {
      const right = itBelow1000(w.slice(5));
      return right == null ? null : 1000 + right;
    }
    return itBelow1000(w);
  }

  const IT_ORDINALS = { secondo: 2, seconda: 2, terzo: 3, terza: 3, quarto: 4, quarta: 4,
    quinto: 5, quinta: 5, sesto: 6, sesta: 6, settimo: 7, settima: 7, ottavo: 8, ottava: 8,
    nono: 9, nona: 9, decimo: 10, decima: 10 };
  // "tre quarti", "un terzo", "due quinti"
  const IT_DENOMINATORS = { mezzo: 2, mezzi: 2, terzo: 3, terzi: 3, quarto: 4, quarti: 4,
    quinto: 5, quinti: 5, sesto: 6, sesti: 6, settimo: 7, settimi: 7, ottavo: 8, ottavi: 8,
    nono: 9, noni: 9, decimo: 10, decimi: 10, centesimo: 100, centesimi: 100 };

  // Ordinals above ten: dodicesimi -> 12, ventitreesimi -> 23 (stem + dropped vowel)
  function itBigOrdinal(w) {
    const m = /^(.+?)esim[oiae]$/.exec(w || '');
    if (!m) return null;
    for (const end of ['', 'i', 'e', 'a', 'o']) {
      const n = itNumberWord(m[1] + end);
      if (n != null && n > 10) return n;
    }
    return null;
  }
  const itDenominator = (w) => IT_DENOMINATORS[w] || itBigOrdinal(w);   // "tre quarti", "sette dodicesimi"
  const itOrdinal = (w) => IT_ORDINALS[w] || itBigOrdinal(w);           // "alla quarta", "alla dodicesima"

  // "1.000" / "12.500,75" (Italian format: dot for thousands, comma for decimals)
  function itDigits(w) {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(w)) return Number(w.replace(/\./g, '').replace(',', '.'));
    if (/^\d+,\d+$/.test(w)) return Number(w.replace(',', '.'));
    if (/^\d+(\.\d+)?$/.test(w)) return Number(w);
    return null;
  }
  const itAnyNumber = (w) => (w == null ? null : itDigits(w) ?? itNumberWord(w));

  function itMergeable(prev, cur) {
    if (prev >= 1000 && prev % 1000 === 0 && cur < 1000) return true;                 // duemila trecento
    if (prev >= 100 && prev % 100 === 0 && prev < 1000 && cur < 100) return true;     // cento venti
    if (prev >= 20 && prev < 100 && prev % 10 === 0 && cur < 10 && cur > 0) return true; // venti tre
    return false;
  }

  // ---- English numbers ----
  const EN_SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19 };
  const EN_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const EN_ORDINALS = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  const EN_DENOMINATORS = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4,
    fifth: 5, fifths: 5, sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8,
    ninth: 9, ninths: 9, tenth: 10, tenths: 10, hundredth: 100, hundredths: 100 };
  const EN_SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };

  function enWordNumber(w) {
    if (w in EN_SMALL) return EN_SMALL[w];
    if (w in EN_TENS) return EN_TENS[w];
    return null;
  }
  function enDigit(w) {
    if (w in EN_SMALL && EN_SMALL[w] < 10) return EN_SMALL[w];
    if (w === 'oh') return 0;
    if (/^\d$/.test(w || '')) return Number(w);
    return null;
  }
  // Ordinals above ten: twelfths -> 12, twentieth -> 20
  function enBigOrdinal(w) {
    if (!w) return null;
    const x = w.replace(/s$/, '');
    if (x === 'twelfth') return 12;
    const m = /^(.+?)(ieth|th)$/.exec(x);
    if (!m) return null;
    const n = enWordNumber(m[2] === 'ieth' ? m[1] + 'y' : m[1]);
    return n != null && n > 10 ? n : null;
  }
  const enDenominator = (w) => EN_DENOMINATORS[w] || enBigOrdinal(w);   // "three quarters", "seven twelfths"
  const enOrdinal = (w) => EN_ORDINALS[w] || enBigOrdinal(w);           // "to the fourth", "to the twelfth"

  // "1,000" / "12,500.75" (US format: comma for thousands, dot for decimals)
  function enDigits(w) {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(w)) return Number(w.replace(/,/g, ''));
    if (/^\d*\.\d+$/.test(w) || /^\d+$/.test(w)) return Number(w);
    return null;
  }
  const enAnyNumber = (w) => (w == null ? null : enDigits(w) ?? enWordNumber(w));
  const isNumberish = (w) => w != null && (enDigits(w) != null || enWordNumber(w) != null || w === 'a' || w === 'an');

  // ---- Shared tokenizer pieces ----
  const SUPERSCRIPT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

  function normalizeCommon(s) {
    return s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')      // più -> piu
      .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => ' ^ ' + [...m].map((c) => SUPERSCRIPT[c]).join('') + ' ')   // 5², 10⁻³
      .replace(/[×✕✖·⋅]/g, ' * ')
      .replace(/÷/g, ' / ')
      .replace(/[−–—]/g, ' - ')
      .replace(/°/g, ' ° ')
      .replace(/(\d)\s*x\s*(?=\d)/g, '$1 * ')                 // 5x3
      .replace(/([+*/^()%=?!:;])/g, ' $1 ')
      .replace(/(\d)-/g, '$1 - ')
      .replace(/-(\d)/g, ' - $1')
      .replace(/π/g, ' pi ');
  }

  // "3 plus 5 all over 2": wrap the tokens since the last break / open paren
  function wrapGroup(out) {
    let depth = 0, s = out.length;
    while (s > 0) {
      const t = out[s - 1];
      if (t.t === '|') break;
      if (t.t === ')') depth++;
      else if (t.t === '(') { if (depth === 0) break; depth--; }
      s--;
    }
    if (!out.slice(s).some((t) => t.t === 'num' || t.t === 'const')) return false;
    out.splice(s, 0, { t: '(' });
    out.push({ t: ')' });
    return true;
  }
  // Implicit multiplication (2π, 2√3, 2(3+4)); binds tighter than * and /
  function implicitTimes(out) {
    const u = out[out.length - 1];
    if (u && (u.t === 'num' || u.t === 'const' || u.t === ')' || u.t === '!' || u.t === 'unit')) out.push({ t: 'op', v: '*', implicit: true });
  }
  const canTakePostfix = (u) => u && (u.t === 'num' || u.t === 'const' || u.t === ')' || u.t === '!');
  const nextWithin = (w, i, n, re) => { for (let j = i + 1; j <= i + n && j < w.length; j++) if (re.test(w[j])) return true; return false; };

  // Scoped groups: an opener (root, log, exponent...) only opens a paren when its
  // closing phrase ("end root", "fine logaritmo") appears later in the sentence.
  function makeGroups(w, out, closerAt) {
    const stack = [];
    return {
      open(i, family) {
        if (w[i + 1] === '(') return;
        for (let j = i + 1; j < w.length; j++) {
          const c = closerAt(w, j);
          if (c && c.family === family) { out.push({ t: '(', group: family }); stack.push(family); return; }
        }
      },
      // returns the number of words consumed, or 0
      close(i) {
        const c = closerAt(w, i);
        if (!c || !stack.includes(c.family)) return 0;
        while (stack.length) { out.push({ t: ')' }); if (stack.pop() === c.family) break; }
        return c.len;
      },
    };
  }

  // ---- Italian tokenizer ----
  const IT_PAREN_KIND = /^(tonda|tonde|quadra|quadre|graffa|graffe)$/;
  const IT_TRIG = { seno: 'sin', sen: 'sin', sin: 'sin', coseno: 'cos', cos: 'cos', tangente: 'tan', tan: 'tan', tg: 'tan',
    arcoseno: 'asin', arcseno: 'asin', arcsen: 'asin', arcsin: 'asin', arcocoseno: 'acos', arccoseno: 'acos', arccos: 'acos',
    arcotangente: 'atan', arctangente: 'atan', arctan: 'atan', arctg: 'atan' };
  const IT_FAMILY = { radice: 'root', logaritmo: 'log', log: 'log', ln: 'log', esponente: 'exp', potenza: 'exp', frazione: 'frac',
    seno: 'trig', coseno: 'trig', tangente: 'trig', arcoseno: 'trig', arcocoseno: 'trig', arcotangente: 'trig' };
  // "chiusa radice", "fine del logaritmo", "chiudi valore assoluto", "fine esponente"
  function itCloser(w, i) {
    if (!/^(chiusa|chiuso|chiudi|chiudo|fine)$/.test(w[i] || '')) return null;
    let j = i + 1;
    if (/^(della|del|dello|la|il|lo|l)$/.test(w[j] || '')) j++;
    if (w[j] === 'valore' && w[j + 1] === 'assoluto') return { len: j - i + 2, family: 'abs' };
    const family = IT_FAMILY[w[j]];
    return family ? { len: j - i + 1, family } : null;
  }

  function tokenizeIT(sentence, ans) {
    const w = normalizeCommon(sentence)
      .replace(/√/g, ' radice ')
      .replace(/,(?!\d)/g, ' ')                                // punctuation commas
      .replace(/\.(?!\d)/g, ' ')                               // sentence-ending dots
      .replace(/'/g, ' ')                                      // l'operazione
      // common mis-transcriptions of seno / coseno / tangente
      .replace(/\b(?:cose no|cosi no|cos e no|co seno|cosseno|cozeno)\b(?=\s+(?:di|del|\d|\(|pi|meno))/g, 'coseno')
      .replace(/\b(?:se no|segno|senno|sen o)\b(?=\s+(?:di|del|\d|\(|pi|meno))/g, 'seno')
      .replace(/\b(?:tangenti|tan gente)\b(?=\s+(?:di|del|\d|\(|pi|meno))/g, 'tangente')
      .split(/\s+/).filter(Boolean);
    const out = [];
    const last = () => out[out.length - 1];
    const brk = () => { if (out.length && last().t !== '|') out.push({ t: '|' }); };
    const push = (tok) => out.push(tok);
    const of = (x) => x === 'di' || x === 'del' || x === 'della' || x === 'dello';
    const groups = makeGroups(w, out, itCloser);
    const pushPow = (i) => { push({ t: 'op', v: '^' }); groups.open(i, 'exp'); };
    // digits after "virgola": "14", "zero cinque", "venticinque"
    const decimals = (i) => {
      const a = w[i];
      if (/^\d+$/.test(a || '')) return { s: a, end: i };
      const whole = itNumberWord(a);
      if (whole != null && whole >= 10) return { s: String(whole), end: i };
      let s = '', j = i;
      while (j < w.length && IT_DIGIT[w[j]] != null) s += IT_DIGIT[w[j++]];
      return s ? { s, end: j - 1 } : null;
    };

    for (let i = 0; i < w.length; i++) {
      const p = w[i], nx = w[i + 1], nx2 = w[i + 2];
      const u = last();
      const afterNum = u && u.t === 'num';

      // closing word of an open group: "chiusa radice", "fine logaritmo"…
      const closed = groups.close(i);
      if (closed) { i += closed - 1; continue; }

      // numbers written as digits
      let n = itDigits(p);
      if (n != null) {
        if (nx === 'virgola' && Number.isInteger(n)) {
          const d = decimals(i + 2);
          if (d) { n = Number(n + '.' + d.s); i = d.end; }
        }
        implicitTimesAfterParen(out);
        push({ t: 'num', v: n, words: false });
        continue;
      }

      // numbers written as words
      n = itNumberWord(p);
      if (n != null) {
        let isDecimal = false;
        if (nx === 'virgola') {
          const d = decimals(i + 2);
          if (d) { n = Number(n + '.' + d.s); i = d.end; isDecimal = true; }
        }
        // "cento venti", "duemila trecento", "venti tre"
        if (!isDecimal && afterNum && u.words && itMergeable(u.v, n)) { u.v += n; continue; }
        implicitTimesAfterParen(out);
        push({ t: 'num', v: n, words: !isDecimal });
        continue;
      }

      // multipliers: "2 mila", "tre milioni"
      if (/^(mila|milion[ei]|miliard[oi])$/.test(p) && afterNum) {
        u.v *= p === 'mila' ? 1e3 : p.startsWith('milion') ? 1e6 : 1e9;
        continue;
      }

      // "tre e mezzo", "due e un quarto"
      if (p === 'e' && (nx === 'mezzo' || nx === 'mezza') && afterNum) { u.v += 0.5; i++; continue; }
      if (p === 'e' && (nx === 'un' || nx === 'uno') && nx2 && IT_DENOMINATORS[nx2] && afterNum) {
        u.v += 1 / IT_DENOMINATORS[nx2]; i += 2; continue;
      }

      // Euler's number: "e alla 2", "numero di nepero"
      if (p === 'e' && /^(alla|al|elevato|elevata|\^)$/.test(nx || '') && !canTakePostfix(u)) { push({ t: 'const', v: 'e' }); continue; }
      if (p === 'numero' && nx === 'di' && nx2 === 'nepero') { implicitTimes(out); push({ t: 'const', v: 'e' }); i += 2; continue; }
      if (p === 'nepero') { implicitTimes(out); push({ t: 'const', v: 'e' }); continue; }

      // powers: "al quadrato", "alla terza", "elevato alla meno 3", "elevato a 3 più 1 fine esponente"
      if (p === 'quadrato' && u && (u.t === 'num' || u.t === ')' || u.t === 'const')) { push({ t: 'op', v: '^' }); push({ t: 'num', v: 2 }); continue; }
      if ((p === 'al' || p === 'alla') && nx === 'quadrato') { push({ t: 'op', v: '^' }); push({ t: 'num', v: 2 }); i++; continue; }
      if ((p === 'al' || p === 'alla') && nx === 'cubo') { push({ t: 'op', v: '^' }); push({ t: 'num', v: 3 }); i++; continue; }
      if (p === 'elevato' || p === 'elevata' || p === '^') {
        if (nx === 'a' || nx === 'al' || nx === 'alla' || nx === 'all') i++;
        pushPow(i);
        continue;
      }
      if (p === 'alla' || p === 'all') {
        if (nx && (IT_ORDINALS[nx] || itAnyNumber(nx) != null || nx === 'meno' || nx === '-' || nx === '(' || nx === 'aperta' || nx === 'apri')) {
          if (!(u && u.t === 'op' && u.v === '^')) pushPow(i);
          continue;
        }
      }
      if (itOrdinal(p) && u && u.t === 'op' && u.v === '^') { push({ t: 'num', v: itOrdinal(p) }); continue; }

      // fractions as words: "tre quarti", "un terzo"; "due terzi di 60", "la metà di 80"
      if (itDenominator(p) && (afterNum || (u && u.t === 'const'))) {      // also "pi greco mezzi"
        push({ t: 'op', v: '/', tight: true, word: true }); push({ t: 'num', v: itDenominator(p) });
        if (of(nx)) { push({ t: 'op', v: '*' }); i++; }
        continue;
      }
      if (p === 'la' && nx === 'meta') continue;
      if (p === 'meta') {
        implicitTimes(out);
        push({ t: 'num', v: 1 }); push({ t: 'op', v: '/', tight: true }); push({ t: 'num', v: 2 });
        if (of(nx)) { push({ t: 'op', v: '*' }); i++; }
        continue;
      }

      // operators
      if (p === '+' || p === 'piu' || p === 'plus' || p === 'sommato' || p === 'addizionato') {
        push({ t: 'op', v: '+' }); if (nx === 'a') i++; continue;
      }
      if (p === '-' || p === 'meno' || p === 'sottratto') { push({ t: 'op', v: '-' }); continue; }
      if (p === 'per' && (nx === 'cento' || nx === 'mille') && afterNum) {
        // "20 per cento" -> percentage
        push({ t: nx === 'cento' ? '%' : '%%' }); i++;
        if (of(w[i + 1])) { push({ t: 'op', v: '*' }); i++; }
        continue;
      }
      if (p === '*' || p === 'x' || p === 'per' || p === 'volte' || p === 'moltiplicato' || p === 'moltiplicata' || p === 'times') {
        push({ t: 'op', v: '*' }); if ((p === 'moltiplicato' || p === 'moltiplicata') && nx === 'per') i++; continue;
      }
      if (p === '/' || p === ':' || p === 'diviso' || p === 'divisa' || p === 'fratto' || p === 'fratta' || p === 'su') {
        push({ t: 'op', v: '/', tight: p === 'fratto' || p === 'fratta' || p === 'su' }); if ((p === 'diviso' || p === 'divisa') && nx === 'per') i++; continue;
      }
      if (p === '%' || p === 'percento' || p === 'percentuale') {
        push({ t: '%' });
        if (of(nx)) { push({ t: 'op', v: '*' }); i++; }
        continue;
      }

      // fraction with several terms: "frazione con numeratore 3 più 5 e denominatore 2 più 2 (fine frazione)"
      if (/^(frazione|con|il|la|una|e|al)$/.test(p) && nextWithin(w, i, 3, /^(numeratore|denominatore)$/)) continue;
      if (p === 'numeratore') { implicitTimes(out); push({ t: '(' }); continue; }
      if (p === 'denominatore') {
        push({ t: ')' }); push({ t: 'op', v: '/', tight: true });
        const before = out.length;
        groups.open(i, 'frac');
        if (out.length === before) push({ t: '(', soft: true });   // no "fine frazione": closed automatically at the end
        continue;
      }

      // roots: "radice di 9", "radice quadrata/cubica/quarta di…", "radice di 9 più 16 chiusa radice"
      if (p === 'radice') {
        let fn = 'sqrt', idx;
        if (nx === 'quadrata') i++;
        else if (nx === 'cubica') { fn = 'cbrt'; i++; }
        else if (IT_ORDINALS[nx]) { idx = IT_ORDINALS[nx]; fn = idx === 2 ? 'sqrt' : idx === 3 ? 'cbrt' : 'root'; i++; }
        else if (nx === 'di' && w[i + 2] === 'indice' && itAnyNumber(w[i + 3]) != null) { idx = itAnyNumber(w[i + 3]); fn = 'root'; i += 3; }
        if (of(w[i + 1])) i++;
        implicitTimes(out);
        push(fn === 'root' ? { t: 'fn', v: fn, idx } : { t: 'fn', v: fn });
        groups.open(i, 'root');
        continue;
      }

      // logarithms: "logaritmo di 100", "logaritmo naturale di 5", "logaritmo in base 2 di 8", "ln 5"
      if (p === 'logaritmo' || p === 'log' || p === 'ln') {
        let fn = p === 'ln' ? 'ln' : 'log', base;
        if (w[i + 1] === 'naturale') { fn = 'ln'; i++; }
        else if (w[i + 1] === 'decimale') i++;
        if (w[i + 1] === 'in' && w[i + 2] === 'base') i++;
        if (w[i + 1] === 'base' && itAnyNumber(w[i + 2]) != null) { base = itAnyNumber(w[i + 2]); i += 2; }
        if (of(w[i + 1])) i++;
        implicitTimes(out);
        push({ t: 'fn', v: fn, base });
        groups.open(i, 'log');
        continue;
      }
      // base said after the argument: "logaritmo di 8 in base 2"
      if ((p === 'in' && nx === 'base') || p === 'base') {
        const k = p === 'in' ? i + 2 : i + 1;
        const b = itAnyNumber(w[k]);
        const logTok = b != null && [...out].reverse().find((t) => t.t === 'fn' && t.v === 'log' && t.base == null);
        if (logTok) { logTok.base = b; i = k; continue; }
      }

      // trigonometry: "seno di 30", "seno al quadrato di 30", "arcoseno di 0,5"
      if (IT_TRIG[p]) {
        implicitTimes(out);
        const tok = { t: 'fn', v: IT_TRIG[p] };
        if ((nx === 'al' || nx === 'alla') && (nx2 === 'quadrato' || nx2 === 'cubo')) { tok.pow = nx2 === 'cubo' ? 3 : 2; i += 2; }
        else if (nx === 'quadro') { tok.pow = 2; i++; }
        if (of(w[i + 1])) i++;
        push(tok);
        groups.open(i, 'trig');
        continue;
      }
      if (p === 'valore' && nx === 'assoluto') {
        implicitTimes(out); push({ t: 'fn', v: 'abs' }); i++;
        if (of(w[i + 1])) i++;
        groups.open(i, 'abs');
        continue;
      }
      // angle units: "30 gradi", "2 radianti", "45°"
      if (/^(gradi|grado|°)$/.test(p) && canTakePostfix(u)) { push({ t: 'unit', v: 'deg' }); continue; }
      if (/^(radianti|radiante|rad)$/.test(p) && canTakePostfix(u)) { push({ t: 'unit', v: 'rad' }); continue; }

      // π and the previous result
      if (p === 'pi' || p === 'pigreco') { implicitTimes(out); push({ t: 'const', v: 'pi' }); if (nx === 'greco') i++; continue; }
      if (ans != null && (p === 'ans' || (p === 'risultato' && (nx === 'precedente' || (nx === 'di' && nx2 === 'prima'))))) {
        if (p === 'risultato') i += nx === 'di' ? 2 : 1;
        implicitTimes(out); push({ t: 'num', v: ans, ans: true });
        continue;
      }
      // factorial: "5 fattoriale", "5!"
      if ((p === 'fattoriale' || p === '!') && canTakePostfix(u)) { push({ t: '!' }); continue; }
      // "il tutto": group everything said so far ("3 più 5 tutto fratto 2", "il tutto al quadrato")
      if (p === 'il' && nx === 'tutto') continue;
      if (p === 'tutto' && wrapGroup(out)) continue;

      // parentheses: "aperta parentesi", "apri la parentesi tonda", "parentesi chiusa"
      if (p === '(') { implicitTimes(out); push({ t: '(' }); continue; }
      if (p === ')') { push({ t: ')' }); continue; }
      if (p === 'parentesi') {
        let j = i + 1;
        if (IT_PAREN_KIND.test(w[j] || '')) j++;
        if (/^(aperta|apri|aperte)$/.test(w[j] || '')) { implicitTimes(out); push({ t: '(' }); i = j; continue; }
        if (/^(chiusa|chiudi|chiuse)$/.test(w[j] || '')) { push({ t: ')' }); i = j; continue; }
      }
      if (/^(apri|aperta|apro|aprire|chiudi|chiusa|chiudo|chiudere)$/.test(p)) {
        let j = i + 1;
        if (w[j] === 'la' || w[j] === 'una') j++;
        if (w[j] === 'parentesi') {
          if (IT_PAREN_KIND.test(w[j + 1] || '')) j++;
          if (p.startsWith('ap')) { implicitTimes(out); push({ t: '(' }); } else push({ t: ')' });
          i = j; continue;
        }
      }

      // any other word breaks the calculation
      brk();
    }
    return out;
  }

  // "(2 + 1) 3": a number right after a closing parenthesis multiplies it
  function implicitTimesAfterParen(out) {
    const u = out[out.length - 1];
    if (u && u.t === ')') out.push({ t: 'op', v: '*', implicit: true });
  }

  // ---- English tokenizer ----
  const PAREN = /^(parenthesis|parentheses|paren|parens|bracket|brackets)$/;
  const EN_TRIG = { sine: 'sin', sin: 'sin', cosine: 'cos', cos: 'cos', tangent: 'tan', tan: 'tan',
    arcsine: 'asin', arcsin: 'asin', arccosine: 'acos', arccos: 'acos', arctangent: 'atan', arctan: 'atan' };
  const EN_THE_SKIP = /^(square|cube|root|quantity|log|logarithm|natural|sine|cosine|tangent|sin|cos|tan|arcsine|arccosine|arctangent|inverse|absolute|previous|last|answer|whole|fraction|numerator|denominator|fourth|fifth|sixth|nth|half)$/;
  const EN_GROUP_NEXT = /^(over|divided|divide|times|x|multiplied|squared|cubed|to|raised|plus|minus|[-+*/^])$/;
  const EN_FAMILY = { root: 'root', log: 'log', logarithm: 'log', ln: 'log', exponent: 'exp', power: 'exp', fraction: 'frac',
    sine: 'trig', cosine: 'trig', tangent: 'trig', sin: 'trig', cos: 'trig', tan: 'trig' };
  // "end root", "close the square root", "end of log", "end absolute value", "end exponent"
  function enCloser(w, i) {
    if (!/^(end|close|closed)$/.test(w[i] || '')) return null;
    let j = i + 1;
    if (w[j] === 'of') j++;
    if (w[j] === 'the') j++;
    if (w[j] === 'square' || w[j] === 'cube' || w[j] === 'natural') j++;
    if (w[j] === 'absolute' && w[j + 1] === 'value') return { len: j - i + 2, family: 'abs' };
    const family = EN_FAMILY[w[j]];
    return family ? { len: j - i + 1, family } : null;
  }

  function tokenizeEN(sentence, ans) {
    const w = normalizeCommon(sentence)
      .replace(/√/g, ' root ')
      .replace(/([a-z])-([a-z])/g, '$1 $2')                    // twenty-three
      .replace(/,(?!\d{3}(?!\d))/g, ' ')                       // commas that are not thousands separators
      .replace(/\.(?!\d)/g, ' ')                               // sentence-ending dots
      .replace(/'/g, ' ')                                      // what's
      // common mis-transcriptions of sine / cosine
      .replace(/\b(?:co sign|cosign|co sine|cosign)\b(?=\s+(?:of|\d|\(|pi|minus))/g, 'cosine')
      .replace(/\b(?:sign|signs|sigh|sines)\b(?=\s+(?:of|\d|\(|pi|minus))/g, 'sine')
      .split(/\s+/).filter(Boolean);
    const out = [];
    const last = () => out[out.length - 1];
    const brk = () => { if (out.length && last().t !== '|') out.push({ t: '|' }); };
    const push = (tok) => out.push(tok);
    const sync = (tok) => { tok.v = tok.total + tok.group; };
    const isPow = (tok) => tok && tok.t === 'op' && tok.v === '^';
    const groups = makeGroups(w, out, enCloser);
    const pushPow = (i) => { push({ t: 'op', v: '^' }); groups.open(i, 'exp'); };

    for (let i = 0; i < w.length; i++) {
      const p = w[i], nx = w[i + 1], nx2 = w[i + 2];
      const u = last();
      const afterNum = u && u.t === 'num';

      // closing word of an open group: "end root", "end log"…
      const closed = groups.close(i);
      if (closed) { i += closed - 1; continue; }

      // numbers written as digits
      let n = enDigits(p);
      if (n != null) { implicitTimesAfterParen(out); push({ t: 'num', v: n, words: false }); continue; }

      // "a hundred", "a thousand", "a third", "a half"
      if ((p === 'a' || p === 'an') && nx && (nx === 'hundred' || EN_SCALES[nx] || EN_DENOMINATORS[nx]) && !afterNum) {
        push({ t: 'num', v: 1, words: true, total: 0, group: 1 });
        continue;
      }

      // numbers written as words: "twenty three", "two thousand three hundred"
      n = enWordNumber(p);
      if (n != null) {
        if (afterNum && u.words) {
          const g = u.group;
          if ((g === 0 && u.total > 0) ||
              (g >= 100 && g % 100 === 0 && g < 1000 && n < 100) ||
              (g >= 20 && g < 100 && g % 10 === 0 && n > 0 && n < 10)) {
            u.group += n; sync(u); continue;
          }
        }
        implicitTimesAfterParen(out);
        push({ t: 'num', v: n, words: true, total: 0, group: n });
        continue;
      }
      if (p === 'hundred' && afterNum) {
        if (!u.words) u.v *= 100;
        else if (u.group > 0 && u.group < 100) { u.group *= 100; sync(u); }
        continue;
      }
      if (EN_SCALES[p] && afterNum) {
        const m = EN_SCALES[p];
        if (!u.words) u.v *= m;
        else { u.total += (u.group || 1) * m; u.group = 0; sync(u); }
        continue;
      }
      // "one hundred and five"
      if (p === 'and' && afterNum && u.words && enWordNumber(nx) != null) continue;
      // "three and a half", "two and a quarter"
      if (p === 'and' && afterNum && (nx === 'a' || nx === 'one') && EN_DENOMINATORS[nx2]) {
        const f = 1 / EN_DENOMINATORS[nx2];
        if (u.words) { u.group += f; sync(u); } else u.v += f;
        i += 2; continue;
      }
      // "three point one four"
      if (p === 'point' && afterNum && Number.isInteger(u.v)) {
        let s = '';
        if (/^\d+$/.test(nx || '')) { s = nx; i++; }
        else while (enDigit(w[i + 1]) != null) s += enDigit(w[++i]);
        if (s) { u.v = Number(u.v + '.' + s); u.words = false; continue; }
      }

      // "the square root", "the quantity", "the previous answer"...
      if (p === 'the' && EN_THE_SKIP.test(nx || '')) continue;

      // Euler's number: "e to the 2", "euler's number"
      if (p === 'e' && /^(to|raised|squared|cubed|\^)$/.test(nx || '') && !canTakePostfix(u)) { push({ t: 'const', v: 'e' }); continue; }
      if (p === 'euler' || p === 'eulers') { implicitTimes(out); push({ t: 'const', v: 'e' }); if (nx === 's') i++; if (w[i + 1] === 'number') i++; continue; }

      // powers: "squared", "to the third", "to the minus 3", "to the power of 3 plus 1 end exponent"
      if (p === 'squared' && u && (u.t === 'num' || u.t === ')' || u.t === 'const')) { push({ t: 'op', v: '^' }); push({ t: 'num', v: 2 }); continue; }
      if (p === 'cubed' && u && (u.t === 'num' || u.t === ')' || u.t === 'const')) { push({ t: 'op', v: '^' }); push({ t: 'num', v: 3 }); continue; }
      if (p === 'raised' || p === '^') {
        while (/^(to|the|power|of)$/.test(w[i + 1] || '')) i++;
        pushPow(i);
        continue;
      }
      if (p === 'to' && nx === 'the' && (nx2 === 'power' || EN_ORDINALS[nx2] || isNumberish(nx2) || /^(minus|negative|-|\(|open)$/.test(nx2 || '') || /^\d+(st|nd|rd|th)$/.test(nx2 || ''))) {
        i++;
        if (w[i + 1] === 'power') { i++; if (w[i + 1] === 'of') i++; }
        pushPow(i);
        continue;
      }
      if (p === 'power' && nx === 'of' && afterNum) { i++; pushPow(i); continue; }
      if (enOrdinal(p) && isPow(u)) {
        push({ t: 'num', v: enOrdinal(p) });
        if (w[i + 1] === 'power') i++;
        continue;
      }
      if (/^(\d+)(st|nd|rd|th)$/.test(p) && isPow(u)) { push({ t: 'num', v: parseInt(p, 10) }); if (w[i + 1] === 'power') i++; continue; }

      // nth roots: "fourth root of 16"
      if (EN_ORDINALS[p] && nx === 'root') {
        const idx = EN_ORDINALS[p];
        i++; if (w[i + 1] === 'of') i++;
        implicitTimes(out);
        push(idx === 2 ? { t: 'fn', v: 'sqrt' } : idx === 3 ? { t: 'fn', v: 'cbrt' } : { t: 'fn', v: 'root', idx });
        groups.open(i, 'root');
        continue;
      }

      // fractions as words: "three quarters", "a third"; "two thirds of 60", "half of 80"
      if (enDenominator(p) && (afterNum || (u && u.t === 'const'))) {      // also "pi halves"
        push({ t: 'op', v: '/', tight: true, word: true }); push({ t: 'num', v: enDenominator(p) });
        if (nx === 'of') { push({ t: 'op', v: '*' }); i++; }
        continue;
      }
      if (p === 'half' && nx === 'of') {
        implicitTimes(out);
        push({ t: 'num', v: 1 }); push({ t: 'op', v: '/', tight: true }); push({ t: 'num', v: 2 }); push({ t: 'op', v: '*' });
        i++; continue;
      }

      // operators
      if (p === '+' || p === 'plus') { push({ t: 'op', v: '+' }); continue; }
      if (p === 'added' && nx === 'to') { push({ t: 'op', v: '+' }); i++; continue; }
      if (p === '-' || p === 'minus' || p === 'negative') { push({ t: 'op', v: '-' }); continue; }
      if (p === '*' || p === 'x' || p === 'times') { push({ t: 'op', v: '*' }); continue; }
      if (p === 'multiplied' || p === 'multiply') { push({ t: 'op', v: '*' }); if (nx === 'by') i++; continue; }
      if (p === '/' || p === ':' || p === 'over') { push({ t: 'op', v: '/', tight: p === 'over' }); continue; }
      if (p === 'divided' || p === 'divide') { push({ t: 'op', v: '/' }); if (nx === 'by') i++; continue; }
      if (p === '%' || p === 'percent' || (p === 'per' && nx === 'cent')) {
        if (p === 'per') i++;
        push({ t: '%' });
        if (w[i + 1] === 'of') { push({ t: 'op', v: '*' }); i++; }
        continue;
      }

      // fraction with several terms: "fraction with numerator 3 plus 5 and denominator 2 plus 2 (end fraction)"
      if (/^(fraction|with|a|and)$/.test(p) && nextWithin(w, i, 3, /^(numerator|denominator)$/)) continue;
      if (p === 'numerator') { implicitTimes(out); push({ t: '(' }); continue; }
      if (p === 'denominator') {
        push({ t: ')' }); push({ t: 'op', v: '/', tight: true });
        const before = out.length;
        groups.open(i, 'frac');
        if (out.length === before) push({ t: '(', soft: true });
        continue;
      }

      // roots: "square root of 144", "cube root of 27", "root 2"
      if (((p === 'square' || p === 'cube') && nx === 'root') || p === 'root') {
        const fn = p === 'cube' ? 'cbrt' : 'sqrt';
        if (p !== 'root') i++;
        if (w[i + 1] === 'of') i++;
        implicitTimes(out);
        push({ t: 'fn', v: fn });
        groups.open(i, 'root');
        continue;
      }

      // logarithms: "log of 100", "natural log of 5", "log base 2 of 8", "log of 8 base 2", "ln 5"
      if (p === 'natural' && (nx === 'log' || nx === 'logarithm')) {
        i++; if (w[i + 1] === 'of') i++;
        implicitTimes(out); push({ t: 'fn', v: 'ln' });
        groups.open(i, 'log');
        continue;
      }
      if (p === 'log' || p === 'logarithm' || p === 'ln') {
        let base;
        if (w[i + 1] === 'to' && w[i + 2] === 'the' && w[i + 3] === 'base') i += 2;
        if (w[i + 1] === 'base' && enAnyNumber(w[i + 2]) != null) { base = enAnyNumber(w[i + 2]); i += 2; }
        if (w[i + 1] === 'of') i++;
        implicitTimes(out);
        push({ t: 'fn', v: p === 'ln' ? 'ln' : 'log', base });
        groups.open(i, 'log');
        continue;
      }
      // base said after the argument: "log of 8 base 2", "log of 8 to the base 2"
      if (p === 'base' || (p === 'to' && nx === 'the' && nx2 === 'base')) {
        const k = p === 'base' ? i + 1 : i + 3;
        const b = enAnyNumber(w[k]);
        const logTok = b != null && [...out].reverse().find((t) => t.t === 'fn' && t.v === 'log' && t.base == null);
        if (logTok) { logTok.base = b; i = k; continue; }
      }

      // trigonometry: "sine of 30", "sine squared of 30", "inverse sine of 0.5", "arcsine of 0.5"
      if (p === 'inverse' && (nx === 'sine' || nx === 'cosine' || nx === 'tangent' || nx === 'sin' || nx === 'cos' || nx === 'tan')) {
        implicitTimes(out); i++;
        if (w[i + 1] === 'of') i++;
        push({ t: 'fn', v: 'a' + EN_TRIG[nx] });
        groups.open(i, 'trig');
        continue;
      }
      if (EN_TRIG[p]) {
        implicitTimes(out);
        const tok = { t: 'fn', v: EN_TRIG[p] };
        if (nx === 'squared' || nx === 'cubed') { tok.pow = nx === 'cubed' ? 3 : 2; i++; }
        if (w[i + 1] === 'of') i++;
        push(tok);
        groups.open(i, 'trig');
        continue;
      }
      if (p === 'absolute' && nx === 'value') {
        implicitTimes(out); push({ t: 'fn', v: 'abs' }); i++;
        if (w[i + 1] === 'of') i++;
        groups.open(i, 'abs');
        continue;
      }
      // angle units: "30 degrees", "2 radians", "45°"
      if (/^(degrees|degree|°)$/.test(p) && canTakePostfix(u)) { push({ t: 'unit', v: 'deg' }); continue; }
      if (/^(radians|radian|rad)$/.test(p) && canTakePostfix(u)) { push({ t: 'unit', v: 'rad' }); continue; }

      // π and the previous result
      if (p === 'pi') { implicitTimes(out); push({ t: 'const', v: 'pi' }); continue; }
      if (ans != null && (p === 'ans' || p === 'answer' || ((p === 'previous' || p === 'last') && (nx === 'result' || nx === 'answer')))) {
        if (p === 'previous' || p === 'last') i++;
        implicitTimes(out); push({ t: 'num', v: ans, ans: true });
        continue;
      }
      // factorial: "5 factorial", "5!"
      if ((p === 'factorial' || p === '!') && canTakePostfix(u)) { push({ t: '!' }); continue; }
      // group everything said so far: "3 plus 5 all over 2", "all squared", "the whole thing times 4"
      if ((p === 'all' || p === 'everything') && EN_GROUP_NEXT.test(nx || '') && wrapGroup(out)) continue;
      if (p === 'whole' && nx === 'thing' && wrapGroup(out)) { i++; continue; }

      // parentheses: "open parenthesis", "open round bracket", "the quantity … end quantity"
      if (p === '(') { implicitTimes(out); push({ t: '(' }); continue; }
      if (p === ')') { push({ t: ')' }); continue; }
      if (p === 'quantity') { implicitTimes(out); push({ t: '(' }); continue; }
      if ((p === 'end' || p === 'close') && nx === 'quantity') { push({ t: ')' }); i++; continue; }
      if (p === 'open' || p === 'left' || p === 'close' || p === 'right' || p === 'closed') {
        let j = i + 1;
        if (w[j] === 'the') j++;
        if (w[j] === 'round' || w[j] === 'square' || w[j] === 'curly') j++;
        if (PAREN.test(w[j] || '')) {
          if (p === 'open' || p === 'left') { implicitTimes(out); push({ t: '(' }); } else push({ t: ')' });
          i = j; continue;
        }
      }
      if (PAREN.test(p) && (nx === 'open' || nx === 'opened')) { implicitTimes(out); push({ t: '(' }); i++; continue; }
      if (PAREN.test(p) && (nx === 'close' || nx === 'closed')) { push({ t: ')' }); i++; continue; }

      // any other word breaks the calculation
      brk();
    }
    return out;
  }

  function tokenize(sentence, ans) { return lang === 'it' ? tokenizeIT(sentence, ans) : tokenizeEN(sentence, ans); }

  // ---- Parser (recursive descent) -> expression tree ----
  // expr    := term (('+'|'-') term)*
  // term    := unary (('*'|'/') unary)*
  // unary   := '-' unary | '+' unary | bar
  // bar     := juxt ('/'-fraction-bar juxt)*     "fratto", "over", "sette ottavi": tighter than × and ÷
  // juxt    := power (implicit-'*' power)*       "2π", "2√3": tighter than × and ÷
  // power   := postfix ('^' expo)?
  // postfix := primary ('%' | '!' | unit)*
  // primary := num | const | '(' expr ')'? | fn fnArg
  //
  // Nodes: num{v,ans?} const{name} bin{op,a,b,implicit?} neg{a} pow{a,b} pct{a,permille}
  //        fact{a} unit{a,u} fn{f,a,base?,idx?,pow?} par{a,open?} empty
  // Unclosed parens are kept as open:true and closed implicitly on evaluation.
  function analyze(tokens, partial) {
    let i = 0, operations = 0, incomplete = false;
    const peek = () => tokens[i];
    const isOp = (ops) => peek() && peek().t === 'op' && ops.includes(peek().v);
    const STOP = {};

    function expr() {
      let a = term();
      while (isOp('+-')) { const op = tokens[i++].v; operations++; a = { k: 'bin', op, a, b: term() }; }
      return a;
    }
    function term() {
      let a = unary();
      while (isOp('*/') && !peek().implicit && !peek().tight) { const op = tokens[i++].v; operations++; a = { k: 'bin', op, a, b: unary() }; }
      return a;
    }
    function unary() {
      if (isOp('-')) { i++; return { k: 'neg', a: unary() }; }
      if (isOp('+')) { i++; return unary(); }
      return bar();
    }
    // fraction bar: 7/8 * 4/3 rather than ((7/8)*4)/3
    function bar() {
      let a = juxt();
      while (isOp('/') && peek().tight) {
        i++; operations++;
        const b = isOp('-') ? (i++, { k: 'neg', a: juxt() }) : juxt();
        a = { k: 'bin', op: '/', bar: true, a, b };
      }
      return a;
    }
    function juxt() {
      let a = power();
      while (isOp('*') && peek().implicit) { i++; operations++; a = { k: 'bin', op: '*', implicit: true, a, b: power() }; }
      return a;
    }
    function power() {
      const b = postfix();
      if (isOp('^')) { i++; operations++; return { k: 'pow', a: b, b: expo() }; }
      return b;
    }
    // exponent: stops at an explicit bar (3³/√9) but keeps word fractions (8^(1/3))
    function expo() {
      if (isOp('-')) { i++; return { k: 'neg', a: expo() }; }
      if (isOp('+')) { i++; return expo(); }
      let a = power();
      while (isOp('/') && peek().tight && peek().word) { i++; operations++; a = { k: 'bin', op: '/', bar: true, a, b: power() }; }
      return a;
    }
    function postfix() {
      let v = primary();
      while (peek() && /^(%|%%|!|unit)$/.test(peek().t)) {
        const t = tokens[i++];
        if (t.t === 'unit') { v = { k: 'unit', a: v, u: t.v }; continue; }
        operations++;
        v = t.t === '!' ? { k: 'fact', a: v } : { k: 'pct', a: v, permille: t.t === '%%' };
      }
      return v;
    }
    // Function argument: one operand plus its exponent (√((2+1)²)), implicit
    // products (sin 2π) and, for trig, a fraction of π (sin(π/6)). An explicitly
    // closed group ("end root") is the whole argument.
    function fnArg(f) {
      if (isOp('-')) { i++; return { k: 'neg', a: fnArg(f) }; }     // "absolute value of minus 7"
      if (peek() && peek().t === '(' && peek().group) return primary();
      const piece = () => {
        const b = postfix();
        if (isOp('^')) { i++; operations++; return { k: 'pow', a: b, b: expo() }; }
        return b;
      };
      let a = piece();
      while (isOp('*') && peek().implicit) { i++; operations++; a = { k: 'bin', op: '*', implicit: true, a, b: piece() }; }
      if (TRIG[f] && containsPi(a) && isOp('/') && tokens[i + 1] && tokens[i + 1].t === 'num') {
        i++; operations++;
        a = { k: 'bin', op: '/', a, b: postfix() };
      }
      return a;
    }
    function primary() {
      const t = peek();
      if (!t) {
        if (partial) { incomplete = true; return { k: 'empty' }; }
        throw STOP;
      }
      if (t.t === 'num') { i++; return t.ans ? { k: 'num', v: t.v, ans: true } : { k: 'num', v: t.v }; }
      if (t.t === 'const') { i++; return { k: 'const', name: t.v }; }
      if (t.t === '(') {
        i++;
        const a = expr();
        if (peek() && peek().t === ')') { i++; return { k: 'par', a }; }
        return t.soft ? { k: 'par', a, open: true, soft: true } : { k: 'par', a, open: true };
      }
      if (t.t === 'fn') {
        i++; operations++;
        const node = { k: 'fn', f: t.v, a: fnArg(t.v) };
        if (t.base != null) node.base = t.base;
        if (t.idx != null) node.idx = t.idx;
        if (t.pow != null) node.pow = t.pow;
        return node;
      }
      throw STOP;
    }

    try {
      const ast = expr();
      if (i !== tokens.length || operations === 0) return null;
      const value = incomplete ? NaN : evaluate(ast);
      // keep non-finite results in partial mode so the UI can report them
      if (!incomplete && !Number.isFinite(value) && !partial) return null;
      return { ast, value, complete: !incomplete, latex: latex(ast), text: text(ast) };
    } catch (e) {
      if (e === STOP) return null;
      throw e;
    }
  }

  // ---- Evaluation ----
  const TRIG = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
  const INV_TRIG = { asin: Math.asin, acos: Math.acos, atan: Math.atan };
  const has = (n, test) => !!n && typeof n === 'object' && (test(n) || has(n.a, test) || has(n.b, test));
  const containsPi = (n) => has(n, (x) => x.k === 'const' && x.name === 'pi');
  const inRadians = (n) => containsPi(n) || has(n, (x) => x.k === 'unit' && x.u === 'rad');
  const saysDegrees = (n) => has(n, (x) => x.k === 'unit' && x.u === 'deg');
  const tidy = (x) => (Math.abs(x) < 1e-12 ? 0 : Number(x.toPrecision(14)));

  function evaluate(n) {
    switch (n.k) {
      case 'num': return n.v;
      case 'const': return n.name === 'e' ? Math.E : Math.PI;
      case 'empty': return NaN;
      case 'par': return evaluate(n.a);
      case 'unit': return evaluate(n.a);
      case 'neg': return -evaluate(n.a);
      case 'pct': return evaluate(n.a) / (n.permille ? 1000 : 100);
      case 'fact': {
        const x = evaluate(n.a);
        if (!Number.isInteger(x) || x < 0 || x > 170) return NaN;
        let r = 1;
        for (let k = 2; k <= x; k++) r *= k;
        return r;
      }
      case 'fn': {
        const r = evalFn(n);
        return n.pow != null ? Math.pow(r, n.pow) : r;
      }
      case 'pow': {
        const b = evaluate(n.a), e = evaluate(n.b);
        // cube root style powers of negative numbers: (−8)^(1/3) = −2
        if (b < 0 && !Number.isInteger(e)) {
          const inv = 1 / e;
          if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -Math.pow(-b, e);
        }
        return Math.pow(b, e);
      }
      case 'bin': {
        const a = evaluate(n.a), b = evaluate(n.b);
        return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
      }
    }
    return NaN;
  }
  function evalFn(n) {
    const x = evaluate(n.a);
    switch (n.f) {
      case 'sqrt': return Math.sqrt(x);
      case 'cbrt': return Math.cbrt(x);
      case 'root': {
        if (x < 0) return n.idx % 2 === 1 ? -tidy(Math.pow(-x, 1 / n.idx)) : NaN;
        return tidy(Math.pow(x, 1 / n.idx));
      }
      case 'abs': return Math.abs(x);
      case 'ln': return x > 0 ? Math.log(x) : NaN;
      case 'log':
        if (!(x > 0)) return NaN;
        if (n.base == null) return Math.log10(x);
        return n.base > 0 && n.base !== 1 ? tidy(Math.log(x) / Math.log(n.base)) : NaN;
      case 'sin': case 'cos': case 'tan': {
        const rad = inRadians(n.a) ? x : x * Math.PI / 180;     // degrees unless π or radians are involved
        if (n.f === 'tan' && Math.abs(Math.cos(rad)) < 1e-12) return NaN;
        return tidy(TRIG[n.f](rad));
      }
      case 'asin': case 'acos': case 'atan': {
        if (n.f !== 'atan' && (x < -1 || x > 1)) return NaN;
        return tidy(INV_TRIG[n.f](x) * 180 / Math.PI);           // answer in degrees
      }
    }
    return NaN;
  }

  // ---- Math notation (LaTeX, rendered with KaTeX) ----
  function numTex(v) {
    const s = format(v);
    const m = s.match(/^(−?[\d.,]+)e(-?\d+)$/);
    if (m) return m[1].replace('−', '-').replace(',', '{,}') + ' \\times 10^{' + Number(m[2]) + '}';
    const t = s.replace('−', '-');
    return lang === 'it' ? t.replace(/\./g, '\\,').replace(/,/g, '{,}') : t.replace(/,/g, '{,}');
  }
  // previous result, rounded for display
  const ansValue = (v) => Math.round(v * 1e6) / 1e6;
  const unwrap = (n) => n.k === 'par' && (!n.open || n.soft) ? latex(n.a) : latex(n);
  const FN_TEX = { ln: '\\ln', sin: '\\sin', cos: '\\cos', tan: '\\tan', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan' };
  const isTrig = (f) => !!TRIG[f];
  // degree sign for trig arguments, unless in radians or already marked
  const degMark = (n) => (isTrig(n.f) && !inRadians(n.a) && !saysDegrees(n.a) ? '^{\\circ}' : '');
  function fnTex(n) {
    if (n.f === 'sqrt') return '\\sqrt{' + unwrap(n.a) + '}';
    if (n.f === 'cbrt') return '\\sqrt[3]{' + unwrap(n.a) + '}';
    if (n.f === 'root') return '\\sqrt[' + n.idx + ']{' + unwrap(n.a) + '}';
    if (n.f === 'abs') return '\\left|' + unwrap(n.a) + '\\right|';
    let name = n.f === 'log' ? (n.base != null ? '\\log_{' + numTex(n.base) + '}' : '\\log') : FN_TEX[n.f];
    if (n.pow != null) name += '^{' + n.pow + '}';
    const deg = degMark(n);
    const a = n.a;
    if ((a.k === 'num' && a.v >= 0) || a.k === 'const' || (a.k === 'unit' && a.a.k === 'num')) return name + ' ' + latex(a) + deg;
    if (a.k === 'empty') return name + ' ' + latex(a);
    if (a.k === 'par') return name + latex(a) + (a.open ? '' : deg);
    return name + '\\left(' + latex(a) + '\\right)' + deg;
  }
  function implicitTex(n) {
    const a = latex(n.a), b = latex(n.b);
    const tight = n.b.k === 'const' || n.b.k === 'fn' || n.b.k === 'par';
    return tight ? a + (n.b.k === 'fn' && n.b.f !== 'sqrt' && n.b.f !== 'cbrt' && n.b.f !== 'root' ? '\\,' : '') + b : a + ' \\cdot ' + b;
  }
  function latex(n) {
    switch (n.k) {
      case 'num': return numTex(n.ans ? ansValue(n.v) : n.v);
      case 'const': return n.name === 'e' ? 'e' : '\\pi';
      case 'empty': return '{\\color{#9a9aa0}\\square}';
      case 'par': return '\\left(' + latex(n.a) + (n.open ? '\\right.' : '\\right)');
      case 'neg': return '-' + latex(n.a);
      case 'pct': return latex(n.a) + (n.permille ? '\\text{‰}' : '\\%');
      case 'unit': return latex(n.a) + (n.u === 'deg' ? '^{\\circ}' : '\\,\\text{rad}');
      case 'fact': {
        const simple = (n.a.k === 'num' && n.a.v >= 0) || n.a.k === 'par' || n.a.k === 'const';
        return (simple ? latex(n.a) : '\\left(' + unwrap(n.a) + '\\right)') + '!';
      }
      case 'fn': return fnTex(n);
      case 'pow': {
        // (√x)³ rather than √x³, which reads as if the exponent were under the root
        const simple = (n.a.k === 'num' && n.a.v >= 0) || n.a.k === 'par' || n.a.k === 'empty' || n.a.k === 'const' ||
          (n.a.k === 'fn' && n.a.f === 'abs');
        const base = simple ? latex(n.a) : '\\left(' + unwrap(n.a) + '\\right)';
        return base + '^{' + unwrap(n.b) + '}';
      }
      case 'bin': {
        if (n.op === '/') {
          // division between fractions: 9/10 : 3/4 (÷ in English)
          const isBar = (x) => x.k === 'bin' && x.op === '/' && x.bar;
          if (!n.bar && (isBar(n.a) || isBar(n.b))) return latex(n.a) + (lang === 'it' ? ' : ' : ' \\div ') + latex(n.b);
          return '\\frac{' + unwrap(n.a) + '}{' + unwrap(n.b) + '}';
        }
        if (n.implicit) return implicitTex(n);
        const b = n.b.k === 'neg' ? '\\left(' + latex(n.b) + '\\right)' : latex(n.b);
        if (n.op === '*') return latex(n.a) + ' \\cdot ' + b;
        return latex(n.a) + ' ' + n.op + ' ' + b;
      }
    }
    return '';
  }

  // plain text (history, fallback when KaTeX is missing)
  function text(n) {
    const isSum = (x) => x.k === 'bin' && (x.op === '+' || x.op === '-');
    switch (n.k) {
      case 'num': return format(n.ans ? ansValue(n.v) : n.v);
      case 'const': return n.name === 'e' ? 'e' : 'π';
      case 'empty': return '□';
      case 'par':
        if (n.soft) return '(' + text(n.a) + ')';
        if (n.a.k === 'num' || n.a.k === 'const') return text(n.a);          // (1) -> 1
        return '(' + text(n.a) + (n.open ? '' : ')');
      case 'neg': return '−' + text(n.a);
      case 'pct': return text(n.a) + (n.permille ? '‰' : '%');
      case 'unit': return text(n.a) + (n.u === 'deg' ? '°' : ' rad');
      case 'fact': {
        const simple = (n.a.k === 'num' && n.a.v >= 0) || n.a.k === 'par' || n.a.k === 'const';
        return (simple ? text(n.a) : '(' + text(n.a) + ')') + '!';
      }
      case 'fn': {
        if (n.f === 'sqrt' || n.f === 'cbrt' || n.f === 'root') {
          const plain = n.a.k === 'num' || n.a.k === 'par' || n.a.k === 'empty' || n.a.k === 'const';
          const sym = n.f === 'sqrt' ? '√' : n.f === 'cbrt' ? '∛' : n.idx + '√';
          return sym + (plain ? text(n.a) : '(' + text(n.a) + ')');
        }
        if (n.f === 'abs') return '|' + text(n.a.k === 'par' ? n.a.a : n.a) + '|';
        let name = n.f === 'log' && n.base != null ? 'log_' + format(n.base) : { asin: 'arcsin', acos: 'arccos', atan: 'arctan' }[n.f] || n.f;
        if (n.pow != null) name += '^' + n.pow;
        const deg = degMark(n) ? '°' : '';
        const isPar = n.a.k === 'par';
        const simpleArg = n.a.k === 'num' || n.a.k === 'const';
        return name + '(' + text(isPar ? n.a.a : n.a) + (simpleArg ? deg : '') + (isPar && n.a.open ? '' : ')') + (simpleArg ? '' : deg);
      }
      case 'pow': {
        const w = (x) => (x.k === 'num' && x.v >= 0) || x.k === 'par' || x.k === 'empty' || x.k === 'const' ? text(x) : '(' + text(x) + ')';
        return w(n.a) + '^' + w(n.b);
      }
      case 'bin': {
        if (n.implicit) return text(n.a) + (n.b.k === 'const' || n.b.k === 'fn' || n.b.k === 'par' ? '' : ' × ') + text(n.b);
        if (n.bar) {   // fraction bar: 7/8, (3 + 5)/2
          const w = (x) => (x.k === 'num' && x.v >= 0) || x.k === 'const' || x.k === 'par' || x.k === 'fn' || x.k === 'pow' ? text(x) : '(' + text(x) + ')';
          return w(n.a) + '/' + w(n.b);
        }
        const sym = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ' }[n.op];
        const a = n.op !== '+' && n.op !== '-' && isSum(n.a) ? '(' + text(n.a) + ')' : text(n.a);
        const bCompound = n.b.k === 'neg' || (n.op === '/' && n.b.k === 'bin') || (n.op !== '+' && isSum(n.b));
        return a + sym + (bCompound ? '(' + text(n.b) + ')' : text(n.b));
      }
    }
    return '';
  }

  // ---- Finding the calculation inside a sentence ----
  function find(sentence, options) {
    const partial = !!(options && options.partial);
    const ans = options && Number.isFinite(options.ans) ? options.ans : null;
    const toks = tokenize(sentence, ans);
    const segments = [];
    let cur = [];
    for (const t of toks) {
      if (t.t === '|') { if (cur.length) segments.push(cur); cur = []; }
      else cur.push(t);
    }
    if (cur.length) segments.push(cur);

    // search from the last segment; atEnd = nothing but the calculation follows
    const endsWithBreak = toks.length > 0 && toks[toks.length - 1].t === '|';
    for (let s = segments.length - 1; s >= 0; s--) {
      const atEnd = s === segments.length - 1 && !endsWithBreak;
      let seg = segments[s];
      // leading operator: continue from the previous result
      if (ans != null && seg.length > 1 && seg[0].t === 'op' && !seg[0].implicit && '+*/^'.includes(seg[0].v)) {
        seg = [{ t: 'num', v: ans, ans: true }].concat(seg);
      }
      if (partial) {
        for (let a = 0; a < seg.length; a++) {
          const r = analyze(seg.slice(a), true);
          if (r) { r.atEnd = atEnd; return r; }
        }
        continue;
      }
      // longest valid subsequence, preferring the rightmost one
      for (let len = seg.length; len >= 2; len--) {
        for (let a = seg.length - len; a >= 0; a--) {
          const r = analyze(seg.slice(a, a + len), false);
          if (r && r.complete) { r.atEnd = atEnd && a + len === seg.length; return r; }
        }
      }
    }
    return null;
  }

  // ---- Formatting ----
  // Scientific notation outside [1e-4, 1e15): format() -> "1.6e-19", pretty() -> "1.6 × 10⁻¹⁹"
  function format(v) {
    if (!Number.isFinite(v)) return String(v);
    const neg = v < 0, x = Math.abs(v);
    const rounded = x >= 1e15 ? x : Number(x.toPrecision(12));
    let s;
    if (rounded >= 1e15 || (rounded !== 0 && rounded < 1e-4)) {
      const [m, e] = rounded.toExponential(6).split('e');
      let mant = m.replace(/\.?0+$/, '');
      if (lang === 'it') mant = mant.replace('.', ',');
      s = mant + 'e' + Number(e);
    } else {
      const groupFrom = lang === 'it' ? 10000 : 1000;
      s = rounded.toLocaleString(LOCALE[lang], { maximumFractionDigits: 10, useGrouping: rounded >= groupFrom });
    }
    return (neg ? '−' : '') + s;
  }
  const SUP_DIGITS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function pretty(v) {
    const s = format(v);
    const m = s.match(/^(−?[\d.,]+)e(-?\d+)$/);
    return m ? m[1] + ' × 10' + [...m[2]].map((c) => SUP_DIGITS[c]).join('') : s;
  }

  // equivalent simple fraction for non-integer results: 0.91666 -> {n:11, d:12}
  function fraction(v) {
    if (!Number.isFinite(v) || Math.abs(v - Math.round(v)) < 1e-9) return null;
    const x = Math.abs(v);
    for (let d = 2; d <= 1000; d++) {
      const n = Math.round(x * d);
      if (n === 0) continue;
      if (Math.abs(n / d - x) < 1e-9) {
        return { n, d, negative: v < 0, text: (v < 0 ? '−' : '') + n + '/' + d,
          latex: (v < 0 ? '-' : '') + '\\frac{' + n + '}{' + d + '}' };
      }
    }
    return null;
  }

  // ---- Multiple calculations, sentence comparison ----
  const OPERAND_END = /^(num|const|\)|!|%|%%|unit)$/;
  const OPERAND_START = /^(num|const|fn|\()$/;
  // Split at breaks and where an operand follows an operand ("5 per 3 9 meno 4")
  function splitCalcs(toks) {
    const parts = [];
    let cur = [];
    for (const t of toks) {
      const prev = cur[cur.length - 1];
      if (t.t === '|' || (prev && OPERAND_END.test(prev.t) && OPERAND_START.test(t.t))) {
        if (cur.length) parts.push(cur);
        cur = t.t === '|' ? [] : [t];
      } else cur.push(t);
    }
    if (cur.length) parts.push(cur);
    return parts;
  }
  function findAll(sentence, options) {
    let ans = options && Number.isFinite(options.ans) ? options.ans : null;
    const out = [];
    for (let seg of splitCalcs(tokenize(sentence, ans))) {
      if (ans != null && seg.length > 1 && seg[0].t === 'op' && !seg[0].implicit && '+*/^'.includes(seg[0].v)) {
        seg = [{ t: 'num', v: ans, ans: true }].concat(seg);
      }
      let found = null;
      for (let len = seg.length; len >= 2 && !found; len--) {
        for (let a = seg.length - len; a >= 0 && !found; a--) {
          const r = analyze(seg.slice(a, a + len), false);
          if (r && r.complete) found = r;
        }
      }
      if (found) { out.push(found); ans = found.value; }
    }
    return out;
  }
  // Token signature, so "otto per tre", "8 × 3" and "8x3" compare equal
  function meaningKey(sentence) {
    const toks = tokenize(sentence).map((t) => (t.t === 'num' ? 'n' + t.v : t.t === 'op' ? t.v : t.t === 'fn' ? 'f' + t.v : t.t === 'const' ? 'c' + t.v : t.t));
    while (toks[0] === '|') toks.shift();
    while (toks[toks.length - 1] === '|') toks.pop();
    return toks.join(' ');
  }
  // true if the sentence opens with an operand rather than an operator
  function startsNewCalc(sentence) {
    const first = tokenize(sentence).find((t) => t.t !== '|');
    if (!first) return false;
    return OPERAND_START.test(first.t) && tokenize(sentence)[0].t !== '|';
  }

  const MathSpeech = { setLanguage, getLanguage, find, findAll, meaningKey, startsNewCalc, tokenize, analyze, evaluate, latex, text, format, pretty, fraction, locale: () => LOCALE[lang] };
  if (typeof module !== 'undefined' && module.exports) module.exports = MathSpeech;
  else root.MathSpeech = MathSpeech;
})(typeof window !== 'undefined' ? window : globalThis);
