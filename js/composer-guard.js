// Keeps a textarea "typed by hand only".
// Blocks paste, drop, cut/copy, context menu and bulk insertions, and keeps an
// integrity budget: the field can never hold more characters than were typed.
//
// NOTE: this is a client-side deterrent. Anyone with dev tools can bypass it, so the
// server should re-check (length, and ideally the `typedChars` signal sent with it).

const BULK_LIMIT = 40; // longest single insertion we accept (mobile word suggestions, IME)

export function guardComposer(el, { onBlocked = () => {}, onChange = () => {} } = {}) {
  let budget = 0;          // chars inserted through allowed input
  let lastGood = el.value = '';

  const block = (e, reason) => {
    e.preventDefault();
    e.stopPropagation();
    onBlocked(reason);
  };

  el.addEventListener('paste', (e) => block(e, 'paste'));
  el.addEventListener('drop', (e) => block(e, 'drop'));
  el.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'; });
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('copy', (e) => block(e, 'copy'));
  el.addEventListener('cut', (e) => block(e, 'copy'));
  el.addEventListener('contextmenu', (e) => block(e, 'menu'));

  el.addEventListener('beforeinput', (e) => {
    const t = e.inputType || '';
    if (t.startsWith('insertFrom')) return block(e, 'paste'); // Paste, Drop, Yank, PasteAsQuotation
    if (t === 'insertText' || t === 'insertReplacementText' || t === 'insertCompositionText') {
      const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      if (data.length > BULK_LIMIT) return block(e, 'bulk');
      budget += data.length;
    } else if (t === 'insertLineBreak' || t === 'insertParagraph') {
      budget += 1;
    }
  });

  el.addEventListener('input', () => {
    // Anything that slipped past beforeinput (extensions, scripts) is rolled back.
    if (el.value.length > budget) {
      el.value = lastGood;
      onBlocked('bulk');
    } else {
      lastGood = el.value;
    }
    onChange(el.value);
  });

  return {
    isIntact: () => el.value.length <= budget,
    typedChars: () => budget,
    reset() { el.value = ''; lastGood = ''; budget = 0; onChange(''); },
  };
}
