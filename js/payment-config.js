// Payment settings for PaprKoin checkout.
//
// mode: 'demo'   The checkout runs end to end with no real payment. A clear notice
//                says so. Use this while designing and testing.
//       'stripe' The Pay button sends the visitor to your Stripe Payment Link for the
//                Koin they chose. Stripe takes the card, Apple Pay or Google Pay.
//
// To switch on real payments:
//   1. In the Stripe Dashboard, create a Product for each Koin with its price
//      (Copper 2.99, Silver 6.99, Gold 15.99, Legend 59.99 USD).
//   2. Create a Payment Link for each. Under "After payment", choose
//      "Don't show confirmation page" and redirect to:
//        https://YOUR-SITE/journey.html?paid=stripe&session={CHECKOUT_SESSION_ID}
//   3. Paste each link below and set mode to 'stripe'.
//
// Before going live, confirm payments on a server (a Stripe webhook for
// checkout.session.completed) rather than trusting the return to journey.html.
export const PAYMENT_CONFIG = {
  mode: 'demo',
  currency: 'USD',
  prices: { copper: 2.99, silver: 6.99, gold: 15.99, legend: 59.99 },
  paymentLinks: {
    copper: '',
    silver: '',
    gold: '',
    legend: '',
  },
};
