// Replays speech-recognition event sequences against the running app (Italian UI).
// In the browser console on the app page:
//   const s = document.createElement('script'); s.src = 'tests/replay.js'; document.head.appendChild(s);
//   await runReplay()
(function () {
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const value = () => document.getElementById('value').textContent;
  const history = () => [...document.querySelectorAll('#history .v')].map((x) => x.firstChild.textContent).reverse();

  // fake recognition session: keeps the full result list, as Chrome does
  function session() {
    const slots = [];
    return {
      say(i, tx, isFinal) { slots[i] = [tx, isFinal]; voiceCalcTest.results(i, slots.slice()); },
    };
  }
  async function waitFor(cond, ms) { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) await W(10); return Math.round(performance.now() - t0); }

  const scenarios = {
    'two calculations in a row, both counted': async (s) => {
      s.say(0, '4 per 2', true); await W(80);
      s.say(1, '7 per', false); await W(80);
      s.say(1, '7 per 3', false); await W(80);
      s.say(1, '7 per 3', true); await W(700);
      return [history(), ['8', '21']];
    },
    'continuing after Chrome closes the sentence keeps precedence': async (s) => {
      s.say(0, '4 più 2', true); await W(80);
      s.say(1, 'per 3', false); await W(80);
      s.say(1, 'per 3', true); await W(700);
      return [history(), ['10']];
    },
    'rewritten sentence is not counted twice': async (s) => {
      s.say(0, 'quattro per due', false); await W(1900);            // result via the safety net
      s.say(0, '4x2', true); await W(700);
      return [history(), ['8']];
    },
    'two calculations in one sentence': async (s) => {
      s.say(0, '5 per 3 9 meno 4', true); await W(700);
      return [history(), ['15', '5']];
    },
    'short pauses while talking do not give the result (pause 0.1 s)': async (s) => {
      s.say(0, '4 per 2', false); await W(400);
      const mid1 = value();
      s.say(0, '4 per 2 diviso 3', false); await W(400);
      const mid2 = value();
      s.say(0, '4 per 2 diviso 3 più 53', true); await W(400);
      return [[mid1, mid2, history()], ['•••', '•••', ['≈ 55,666667']]];
    },
    'shorter new sentence in a used slot is not lost': async (s) => {
      s.say(0, '4 per 2 diviso 3 uguale', false); await W(300);
      s.say(0, '7 per 3', false); await W(80);
      s.say(0, '7 per 3', true); await W(700);
      return [history(), ['≈ 2,666667', '21']];
    },
    'sentence never closed by Chrome: result after the safety net': async (s) => {
      s.say(0, '9 per 3', false);
      const ms = await waitFor(() => history().length > 0, 4000);
      return [[history(), ms < 2500], [['27'], true]];
    },
    'alternatives: the calculation wins': async (s) => {
      s.say(0, ['se no di 30', 'seno di 30'], true); await W(700);
      return [history(), ['0,5']];
    },
    'talking about something else: the countdown keeps going': async (s) => {
      document.getElementById('optPause').value = '1000';
      s.say(0, '4 per 2 diviso 3', true); await W(300);
      s.say(1, 'poi passiamo al', false); await W(300);
      s.say(1, 'poi passiamo al prossimo esercizio', false); await W(300);
      s.say(1, 'poi passiamo al prossimo esercizio della pagina', false);
      await waitFor(() => history().length > 0, 3000);
      document.getElementById('optPause').value = '100';
      return [history(), ['≈ 2,666667']];
    },
    '"uguale" gives the result right away': async (s) => {
      s.say(0, '6 per 7 uguale', false); await W(150);
      return [history(), ['42']];
    },
    'starting with an operator continues from the result': async (s) => {
      s.say(0, '6 per 7', true); await W(500);
      s.say(1, 'per 2', true); await W(500);
      return [history(), ['42', '84']];
    },
    'session ends between two calculations (phones)': async (s) => {
      s.say(0, '4 per 2', true);
      voiceCalcTest.restart();                      // new session before the countdown ends
      const s2 = session();
      s2.say(0, '7 per 3', false); await W(80);
      s2.say(0, '7 per 3', true); await W(700);
      return [history(), ['8', '21']];
    },
    'session ends in the middle of a calculation': async (s) => {
      document.getElementById('optPause').value = '1000';
      s.say(0, '4 più 2', true);
      voiceCalcTest.restart();
      const s2 = session();
      s2.say(0, 'per 3', true);
      await waitFor(() => history().length > 0, 3000);
      document.getElementById('optPause').value = '100';
      return [history(), ['10']];
    },
    'fractions: 7/8 · 4/3': async (s) => {
      s.say(0, '7 ottavi per 4 terzi', true); await W(500);
      return [[history(), document.getElementById('expr').innerText.replace(/\s+/g, '')], [['≈ 1,166667'], '78⋅43=87​⋅34​=']];
    },
  };

  window.runReplay = async function () {
    const results = [];
    for (const [name, fn] of Object.entries(scenarios)) {
      document.getElementById('btnClear').click();
      document.getElementById('optPause').value = '100';
      voiceCalcTest.newSession();
      await W(50);
      const [got, want] = await fn(session());
      const pass = JSON.stringify(got) === JSON.stringify(want);
      results.push({ pass, name, got: JSON.stringify(got), want: JSON.stringify(want) });
      await W(200);
    }
    return { passed: results.filter((r) => r.pass).length, total: results.length, results: results.filter((r) => !r.pass).length ? results : results.map((r) => r.name) };
  };
})();
