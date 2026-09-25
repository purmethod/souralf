// GET /api/health → is the shop ready? Shows only safe facts, never the key itself.
const { stripe } = require("./_stripe");

// The account part of a Stripe key, e.g. "51UJWskCGh7EzGI7m" from sk_test_51UJWskCGh7EzGI7m…
const account = (k) => (/^(?:sk|rk|pk)_(?:test|live)_([A-Za-z0-9]{16})/.exec(k || "") || [])[1] || null;

module.exports = async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const pk = String(req.query.pk || "");
  const out = {
    secret_key_set: Boolean(key),
    secret_key_mode: key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : key ? "unknown (must start with sk_test_ or sk_live_)" : null,
    shipping_countries: process.env.SHIPPING_COUNTRIES || "DE (default)",
    keys_match_same_account: pk && key ? account(pk) === account(key) : null,
    keys_match_same_mode: pk && key ? pk.split("_")[1] === key.split("_")[1] : null,
    stripe_reachable: null,
    error: null,
  };
  if (key) {
    try {
      await stripe("GET", "checkout/sessions", { limit: 1 });
      out.stripe_reachable = true;
    } catch (err) {
      out.stripe_reachable = false;
      out.error = err.message;
    }
  }
  out.ready = Boolean(out.secret_key_set && out.stripe_reachable && out.keys_match_same_account !== false && out.keys_match_same_mode !== false);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
};
