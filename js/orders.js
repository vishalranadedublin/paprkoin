// Orders live in this browser so the journey page can rebuild the videos and the
// certificate after payment (including after a round trip to Stripe). Nothing here
// leaves the device; a real backend would store the paid order server-side.
const key = (id) => `pk.order.${id}`;

export function newOrderId() {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PK-${t}-${r}`;
}

export function saveOrder(order) {
  try {
    localStorage.setItem(key(order.id), JSON.stringify(order));
    localStorage.setItem('pk.lastOrder', order.id);
  } catch { /* storage blocked: the journey page will explain */ }
}

export function loadOrder(id) {
  try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; }
}

export const lastOrderId = () => { try { return localStorage.getItem('pk.lastOrder'); } catch { return null; } };
export const setPending = (id) => { try { localStorage.setItem('pk.pendingOrder', id); } catch { /* blocked */ } };
export const takePending = () => {
  try { const id = localStorage.getItem('pk.pendingOrder'); localStorage.removeItem('pk.pendingOrder'); return id; } catch { return null; }
};
