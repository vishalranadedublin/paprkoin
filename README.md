# PaprKoin

Turn your words into a journey. Visitors type a message of up to 200 characters (typed by hand, no pasting), choose a Koin, pick destinations, and watch their words travel across a 3D globe. After checkout they get a film for every destination and a downloadable certificate.

A static site: plain HTML, CSS and JavaScript modules, with Three.js, GSAP, Lenis and d3-geo loaded from CDNs. No build step.

## Pages

- `index.html`: the home page (globe, message box, destinations, Koin Plan, FAQ, contact, sign in, checkout)
- `journey.html`: the page after payment, with the films and the certificate

## Run it locally

```bash
python dev-server.py 5500
```

Then open http://localhost:5500. Exact location needs `localhost` or an `https` address.

## Settings to fill in before going live

- `js/payment-config.js`: switch `mode` to `'stripe'` and add a Stripe Payment Link for each Koin. Confirm payments on a server (Stripe webhook) before trusting them.
- `js/auth-config.js`: a Google OAuth client ID and a Facebook App ID to switch on those sign-in buttons.
- Footer: real links for the social icons and the legal pages, and a mailing-list service for the "New destinations" form.

## Main files

| File | What it does |
| --- | --- |
| `js/main.js` | Page behaviour: theme, nav, message box, journey flow, destinations, sign in, footer |
| `js/globe.js` | The 3D earth and the travelling messages |
| `js/destinations.js` | The destination list, rows and photos |
| `js/checkout.js`, `js/orders.js` | Checkout window and saved orders |
| `js/journey.js`, `js/journey-video.js`, `js/certificate.js` | Journey page, generated films, certificate |
| `js/geo.js` | Approximate (IP) and exact (browser) location |
| `css/styles.css`, `css/journey.css` | All styles, light and dark themes |
