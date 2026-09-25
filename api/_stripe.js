// Minimal Stripe REST client for Vercel functions. No SDK, no dependencies.
// STRIPE_SECRET_KEY lives only in Vercel's environment variables, never in the repo.
const API = "https://api.stripe.com/v1/";

function encode(params, prefix = "", out = []) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY is not set");
    err.status = 503;
    throw err;
  }
  const res = await fetch(API + path + (method === "GET" && params ? `?${encode(params)}` : ""), {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : encode(params || {}),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || "Stripe request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

module.exports = { stripe, encode };
