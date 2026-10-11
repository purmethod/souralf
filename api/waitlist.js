// POST /api/waitlist { email, lang, list } → keeps the address on a waitlist.
// brinkmannpaul.com sends its sign-ups here: this project already holds Paul's
// Stripe key, so the list lives in his Stripe account as customers tagged
// metadata.waitlist (Customers → filter by metadata exports it). An address
// that is already there is not added twice.
const { stripe } = require("./_stripe");

const LISTS = ["cyclemax"];
const LANGS = ["en", "de", "fr", "es", "ar", "ru"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  // A field people never see: bots fill it in, people leave it empty.
  if (body.company) return res.status(200).json({ ok: true });
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ error: "Invalid e-mail" });
  const list = LISTS.includes(body.list) ? body.list : LISTS[0];
  const lang = LANGS.includes(body.lang) ? body.lang : "en";

  try {
    const found = await stripe("GET", "customers", { email, limit: 10 });
    if ((found.data || []).some((c) => c.metadata && c.metadata.waitlist === list)) {
      return res.status(200).json({ ok: true, already: true });
    }
    await stripe("POST", "customers", {
      email,
      description: `${list} waitlist`,
      metadata: { waitlist: list, lang, source: "brinkmannpaul.com", joined: new Date().toISOString().slice(0, 10) },
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(err.status === 503 ? 503 : 502).json({ error: "Waitlist unavailable" });
  }
};
