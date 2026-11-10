# Voice Calculator

A hands-free calculator for math and physics homework. Dictate an expression in **English** or **Italian** and it writes the formula in proper math notation as you speak, then gives the result when you stop talking.

**Live demo:** https://voice-calculator-8aw.pages.dev (Chrome, microphone required)

## Features

- English and Italian: speech recognition, interface and spoken answers follow the selected language
- Long expressions with correct precedence: fractions, powers, roots, logarithms, trigonometry, percentages, factorials, parentheses
- Live formula rendered with KaTeX, exact fraction for non-integer results, scientific notation for very large or small numbers
- Several calculations in a row, or continue from the last result ("times 2")
- Optional read-aloud and wake-word mode ("calculate…")
- Always-on-top mini window, history, light and dark themes

## Running it

The app is a static page: `index.html` and `math-speech.js`, no build step.

It needs **Google Chrome** (or Edge) for the Web Speech API, and the page must be served over `http://localhost` or `https://` for microphone access. To run it locally with [Node.js](https://nodejs.org) 18+:

```
npm start
```

then open http://localhost:4747. On Windows, `start.bat` starts the server in the background and opens a Chrome tab; `stop.bat` stops it.

## Privacy

Speech recognition is done by the browser. In Chrome the audio is sent to Google's speech service, so an internet connection is required. The app itself has no backend: settings and history are stored in the browser's `localStorage`.

## What you can say

| Operation | English | Italian |
|---|---|---|
| Add / subtract | plus, minus | più, meno |
| Multiply / divide | times, x, divided by, over | per, volte, diviso, fratto, su |
| Powers | squared, cubed, to the fifth, to the power of, to the minus 3 | al quadrato, al cubo, alla quinta, elevato a, alla meno 3 |
| Scientific notation | 1.6 times 10 to the minus 19 | 1,6 per 10 alla meno 19 |
| Roots | square root of, cube root of, fourth root of | radice di, radice cubica di, radice quarta di |
| Logarithms | log of, natural log of, log base 2 of 8, log of 8 base 2 | logaritmo di, logaritmo naturale di, logaritmo in base 2 di 8, logaritmo di 8 in base 2 |
| Trigonometry | sine / cosine / tangent of 30, sine squared of 30, sine of pi over 6, sine of 2 radians | seno / coseno / tangente di 30, seno al quadrato di 30, seno di pi greco fratto 6, seno di 2 radianti |
| Inverse trigonometry (degrees) | arcsine / inverse sine of 0.5 | arcoseno di 0,5 |
| Constants, factorial | pi, e to the 2, 5 factorial | pi greco, e alla 2, numero di Nepero, 5 fattoriale |
| Absolute value | absolute value of | valore assoluto di |
| Percent | 20 percent of 80 | 20 per cento di 80 |
| Fractions in words | three quarters, seven twelfths, two thirds of 60, half of 80 | tre quarti, sette dodicesimi, due terzi di 60, la metà di 80 |
| Decimals | three point zero five | tre virgola zero cinque |
| Parentheses | open / close parenthesis, the quantity | aperta / chiusa parentesi, apri la parentesi tonda |
| Previous result | previous answer, or start with "times 2" | risultato precedente, o inizia con "per 2" |
| Instant result | equals | uguale |

### Several terms under one symbol

By default a root, log, sine, absolute value or exponent applies to the number right after it: "square root of 9 plus 16" is √9 + 16. A closing phrase extends it:

| Under one… | English | Italian |
|---|---|---|
| Root | square root of 9 plus 16 **end root** | radice di 9 più 16 **chiusa radice** |
| Logarithm | log of 2 plus 6 **end log** | logaritmo di 2 più 6 **fine logaritmo** |
| Sine / cosine / tangent | sine of 30 plus 60 **end sine** | seno di 30 più 60 **fine seno** |
| Absolute value | absolute value of 3 minus 8 **end absolute value** | valore assoluto di 3 meno 8 **fine valore assoluto** |
| Exponent | 2 to the power of 3 plus 1 **end exponent** | 2 elevato a 3 più 1 **fine esponente** |
| Fraction | **numerator** 3 plus 5 **denominator** 2 plus 2 (**end fraction**) | **numeratore** 3 più 5 **denominatore** 2 più 2 (**fine frazione**) |
| Everything said so far | 3 plus 5 **all over** 2, all squared | 3 più 5 **tutto fratto** 2, il tutto al quadrato |

Parentheses work everywhere; an unclosed one is closed automatically.

### Notation rules

- An exponent right after a function's argument stays inside it, as written by hand: "square root of open parenthesis 2 plus 1 close parenthesis squared" is √((2+1)²). Close the root first to put it outside: "… end root squared" is (√(2+1))².
- "over" / "fratto" and spoken fractions are a fraction bar and bind before × and ÷: "seven eighths times four thirds" is 7/8 · 4/3.
- An explicit fraction bar ends an exponent ("3 cubed over root 9" is 3³/√9); a spoken fraction stays in it ("8 to the one third" is 8^(1/3)).
- Implicit multiplication binds tighter than × and ÷: "1 over 2 pi" is 1/(2π).
- Angles are in degrees unless the argument contains π or is said in radians; "sine of pi over 6" is sin(π/6). Inverse functions answer in degrees.

### Timing

The countdown ring around the microphone is the delay (0.1–3 s, in settings) after you stop talking. A new calculation that starts with a number answers the previous one right away; one that starts with an operator continues it. Saying "equals" answers immediately.

## Project structure

```
index.html            app: UI, translations, speech recognition, history
math-speech.js        spoken-math parser, evaluator and LaTeX renderer
server.js             minimal static server for local use
start.bat, stop.bat   Windows helpers (start-edge.bat for Edge)
tests/
  parser.test.js      parser unit tests
  textbook.test.js    high-school exercises in several spoken variants
  replay.js           replays recognizer events against the running app
```

## Tests

```
npm test
```

runs the parser and textbook suites with Node. `tests/replay.js` runs in the browser: open the app, then in the console

```js
const s = document.createElement('script'); s.src = 'tests/replay.js'; document.head.appendChild(s);
await runReplay();
```

## License

[MIT](LICENSE)
