// Calculator: two separate tools in tabs (coin calculator, trading post fees).
import { $, $$, lang, t } from '../lib/env.js';
import { autocomplete } from '../lib/autocomplete.js';
import { prices } from '../lib/gw2.js';
import { esc, coin, listFee, saleFee } from '../../shared/format.js';

// Tabs (ARIA pattern); the open tab is kept in the URL hash.
const tabs = $$('[role="tab"]');
function select(id, focus) {
  for (const tb of tabs) {
    const on = tb.id === `tab-${id}`;
    tb.setAttribute('aria-selected', String(on));
    tb.tabIndex = on ? 0 : -1;
    $(`#${tb.getAttribute('aria-controls')}`).hidden = !on;
    if (on && focus) tb.focus();
  }
  history.replaceState(null, '', `#${id}`);
}
for (const tb of tabs) {
  tb.addEventListener('click', () => select(tb.id.slice(4)));
  tb.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(tb);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(n.id.slice(4), true);
    }
  });
}
if (location.hash === '#tp') select('tp');

const readCoins = (p) => {
  const n = (id) => Math.max(0, Math.floor(Number(String($(`#${p}${id}`).value).replace(/\D/g, '')) || 0));
  return n('g') * 10000 + n('s') * 100 + n('c');
};
const writeCoins = (p, v) => {
  const a = Math.max(0, Math.round(v));
  $(`#${p}g`).value = Math.floor(a / 10000) || '';
  $(`#${p}s`).value = Math.floor((a % 10000) / 100) || '';
  $(`#${p}c`).value = a % 100 || '';
};

// Coin calculator: the accumulator starts at 0, each button applies the operation with the fields.
let acc = 0;
const res = $('#cres');
const hist = $('#chist');
const showAcc = () => { res.innerHTML = coin(acc, { lang }); };
showAcc();
for (const b of $$('[data-op]')) {
  b.addEventListener('click', () => {
    const op = b.dataset.op;
    const v = readCoins('c');
    const raw = $('#cf').value;
    const f = Number(String(raw).replace(',', '.'));
    const before = acc;
    if (op === 'add') acc += v;
    if (op === 'sub') acc -= v;
    if (op === 'mul') acc = Math.round(acc * (raw !== '' && Number.isFinite(f) ? f : 1));
    if (op === 'div') acc = Math.round(acc / (Number.isFinite(f) && f ? f : 1));
    const sym = { add: '+', sub: '−', mul: '×', div: '÷' }[op];
    const arg = op === 'add' || op === 'sub' ? coin(v, { lang }) : esc(raw || '1');
    hist.insertAdjacentHTML('afterbegin', `<li>${coin(before, { lang })} ${sym} ${arg} = <strong>${coin(acc, { lang })}</strong></li>`);
    while (hist.children.length > 10) hist.lastElementChild.remove();
    showAcc();
  });
}
$('#creset').addEventListener('click', () => { acc = 0; hist.innerHTML = ''; writeCoins('c', 0); $('#cf').value = ''; showAcc(); });

// Fees
const out = $('#tpout');
function calcTp() {
  const p = readCoins('t');
  const q = Math.max(1, Math.floor(Number($('#tq').value) || 1));
  const total = p * q;
  const lf = listFee(p) * q;
  const sf = saleFee(p) * q;
  out.innerHTML = [
    [t('calc.total'), coin(total, { lang })],
    [t('calc.listFee'), coin(-lf, { lang })],
    [t('calc.saleFee'), coin(-sf, { lang })],
    [t('calc.receive'), `<strong>${coin(total - lf - sf, { lang })}</strong>`],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');
}
for (const id of ['tg', 'ts', 'tc', 'tq']) $(`#${id}`).addEventListener('input', calcTp);
calcTp();

const itemBox = $('#tpitem');
autocomplete($('#tpq'), $('#tpq-list'), {
  tp: true,
  onPick: async (id, name) => {
    $('#tpq').value = name;
    itemBox.innerHTML = `<p class="muted small">${esc(t('loading'))}</p>`;
    try {
      const v = (await prices([id])).get(id);
      if (!v) throw new Error('no price');
      itemBox.innerHTML = `<p class="small"><strong>${esc(name)}</strong></p><div class="btn-row"><button type="button" class="btn btn-small" data-use="${v.sell}">${esc(t('calc.useSell'))}: ${coin(v.sell, { lang })}</button><button type="button" class="btn btn-small" data-use="${v.buy}">${esc(t('calc.useBuy'))}: ${coin(v.buy, { lang })}</button></div>`;
      writeCoins('t', v.sell);
      calcTp();
    } catch {
      itemBox.innerHTML = `<p class="notice small">${esc(t('error'))}</p>`;
    }
  },
});
itemBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-use]');
  if (b) { writeCoins('t', Number(b.dataset.use)); calcTp(); }
});
