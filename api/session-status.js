// GET /api/session-status?session_id=… → status of a finished checkout, for the thank-you page.
const { stripe } = require("./_stripe");

module.exports = async (req, res) => {
  const id = String(req.query.session_id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: "Invalid session" });
  try {
    const s = await stripe("GET", `checkout/sessions/${id}`);
    res.status(200).json({ status: s.status, payment_status: s.payment_status });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
