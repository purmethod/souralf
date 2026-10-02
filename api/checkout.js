// POST /api/checkout { quantity, shipping } → embedded Stripe Checkout Session for ÂLF.
// Product, price and shipping rates come from /shop.json (one source for page and server);
// the browser only chooses quantity and shipping zone.
const { stripe } = require("./_stripe");
const shop = require("../shop.json");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const qty = Math.min(shop.max_quantity, Math.max(1, parseInt(body.quantity, 10) || 1));
  const zone = shop.shipping.find((z) => z.id === body.shipping) || shop.shipping[0];
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const p = shop.product;

  try {
    const session = await stripe("POST", "checkout/sessions", {
      ui_mode: "embedded",
      mode: "payment",
      return_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      line_items: {
        0: {
          quantity: qty,
          adjustable_quantity: { enabled: true, minimum: 1, maximum: shop.max_quantity },
          price_data: {
            currency: p.currency,
            unit_amount: p.amount,
            product_data: {
              name: p.name,
              description: p.description,
              images: { 0: `${origin}/assets/video/bubbles-poster.jpg` },
            },
          },
        },
      },
      shipping_address_collection: { allowed_countries: Object.fromEntries(zone.countries.map((c, i) => [i, c])) },
      shipping_options: {
        0: {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: `${zone.service} (${zone.label})`,
            fixed_amount: { amount: zone.amount, currency: p.currency },
          },
        },
      },
      phone_number_collection: { enabled: true },
      metadata: { shipping_zone: zone.id },
    });
    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
