// POST /api/checkout → creates an embedded Stripe Checkout Session for THE ÂLF BOX.
// Price and product live here on the server; the browser only sends the quantity.
const { stripe } = require("./_stripe");

const PRODUCT = {
  name: "THE ÂLF BOX",
  description: "ÂLF · THE ÂLF METHOD · THE ÂLF JAR · THE ÂLF SPOON · THE ÂLF BIO FLOUR",
  amount: 8000, // $80.00 in cents
  currency: "usd",
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const qty = Math.min(9, Math.max(1, parseInt(body.quantity, 10) || 1));
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const countries = (process.env.SHIPPING_COUNTRIES || "DE").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

  try {
    const session = await stripe("POST", "checkout/sessions", {
      ui_mode: "embedded",
      mode: "payment",
      return_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      line_items: {
        0: {
          quantity: qty,
          adjustable_quantity: { enabled: true, minimum: 1, maximum: 9 },
          price_data: {
            currency: PRODUCT.currency,
            unit_amount: PRODUCT.amount,
            product_data: {
              name: PRODUCT.name,
              description: PRODUCT.description,
              images: { 0: `${origin}/assets/photos/box-1200.jpg` },
            },
          },
        },
      },
      shipping_address_collection: { allowed_countries: Object.fromEntries(countries.map((c, i) => [i, c])) },
      phone_number_collection: { enabled: true },
    });
    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
