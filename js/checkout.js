// PaprKoin checkout: one window between choosing places and sending.
// Demo mode completes without taking money; Stripe mode hands over to the Koin's
// Stripe Payment Link (Stripe collects the card, so this page never sees it).
import { PAYMENT_CONFIG as PC } from './payment-config.js';
import { saveOrder, setPending } from './orders.js';
import { byId } from './destinations.js';

const $ = (s, r = document) => r.querySelector(s);
const KOIN_NAME = { copper: 'Copper Koin', silver: 'Silver Koin', gold: 'Gold Koin', legend: 'Legend Koin' };
export const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: PC.currency }).format(n);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const live = () => PC.mode === 'stripe';

export function initCheckout({ onOpen = () => {}, onClose = () => {}, reduced = false } = {}) {
  const dlg = $('#checkout');
  const form = $('#coForm');
  const name = $('#coName');
  const email = $('#coEmail');
  const pay = $('#coPay');
  const done = $('#coDone');
  let current = null;
  let settle = null;
  let outcome = null; // what the window reports once it has fully closed

  $('#coDemo').hidden = live();
  $('#coSecure').textContent = live()
    ? 'Payment is handled by Stripe: card, Apple Pay or Google Pay. PaprKoin never sees your card number.'
    : 'When payments are switched on, Stripe handles them: card, Apple Pay or Google Pay. PaprKoin never sees your card number.';

  const setErr = (input, msg) => {
    const f = input.closest('.field');
    f.classList.toggle('has-error', !!msg);
    $('.field-err', f).textContent = msg;
    input.setAttribute('aria-invalid', String(!!msg));
  };
  [name, email].forEach((el) => el.addEventListener('input', () => { if (el.closest('.field').classList.contains('has-error')) setErr(el, ''); }));

  const finish = (value) => { const s = settle; settle = null; s?.(value); };
  dlg.addEventListener('close', () => { onClose(); finish(outcome); outcome = null; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && !dlg.classList.contains('is-paying')) dlg.close(); });
  dlg.addEventListener('cancel', (e) => { if (dlg.classList.contains('is-paying')) e.preventDefault(); });
  $('[data-co-close]', dlg).addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    if (!name.value.trim()) { setErr(name, 'Add the name to print on your certificate.'); ok = false; }
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { setErr(email, 'Enter an email address like name@example.com.'); ok = false; }
    if (!ok) { (form.querySelector('[aria-invalid="true"]') || name).focus(); return; }

    const order = Object.assign(current, {
      name: name.value.trim(), email: email.value.trim(),
      amount: PC.prices[current.koin], currency: PC.currency,
    });

    if (live()) {
      const link = PC.paymentLinks[order.koin];
      if (!link) { setErr(email, 'This Koin can’t be paid for yet. Please try again later.'); return; }
      order.paid = false;
      saveOrder(order);
      setPending(order.id);
      dlg.classList.add('is-paying');
      pay.disabled = true;
      $('span', pay).textContent = 'Opening secure checkout…';
      const url = new URL(link);
      url.searchParams.set('client_reference_id', order.id);
      finish({ redirected: true, order });
      location.href = url.toString();
      return;
    }

    // demo: a short, honest pause, then the paid stamp
    dlg.classList.add('is-paying');
    pay.disabled = true;
    $('span', pay).textContent = 'Processing…';
    await wait(reduced ? 200 : 1400);
    Object.assign(order, { paid: true, paidAt: new Date().toISOString(), payment: 'demo' });
    saveOrder(order);
    $('#coOrder').textContent = `Order ${order.id}`;
    form.hidden = true;
    done.hidden = false;
    dlg.classList.remove('is-paying');
    await wait(reduced ? 400 : 1900);
    outcome = { paid: true, order };
    dlg.close(); // closing unlocks the page first, then the journey continues
  });

  // fill the window from the order and open it
  return function openCheckout(order, prefill = {}) {
    current = order;
    outcome = null;
    const places = order.picks.map(byId).filter(Boolean);
    const price = PC.prices[order.koin];
    $('.ft-coin', dlg).dataset.metal = order.koin;
    $('#coKoin').textContent = KOIN_NAME[order.koin];
    $('#coCount').textContent = order.koin === 'legend' ? `Every destination, all ${places.length}` : `${places.length} ${places.length === 1 ? 'destination' : 'destinations'}`;
    $('#coPrice').textContent = money(price);
    $('#coTotal').textContent = money(price);
    $('#coFrom').textContent = [order.from.city, order.from.country].filter(Boolean).join(', ') || 'your town';
    const list = $('#coDests');
    list.replaceChildren(...places.map((d) => {
      const li = document.createElement('li');
      li.append(Object.assign(document.createElement('b'), { textContent: d.name }), Object.assign(document.createElement('span'), { textContent: d.where }));
      return li;
    }));
    $('#coNote').textContent = order.message;
    $('span', pay).textContent = live() ? `Pay ${money(price)} with Stripe` : `Pay ${money(price)}`;
    pay.disabled = false;
    form.hidden = false;
    done.hidden = true;
    dlg.classList.remove('is-paying');
    [name, email].forEach((el) => setErr(el, ''));
    if (!name.value && prefill.name) name.value = prefill.name;
    if (!email.value && prefill.email) email.value = prefill.email;
    dlg.showModal();
    onOpen();
    (name.value ? (email.value ? pay : email) : name).focus();
    return new Promise((resolve) => { settle = resolve; });
  };
}
