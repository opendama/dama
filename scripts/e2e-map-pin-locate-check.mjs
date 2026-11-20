/**
 * E2E: Addis pin → /geo/locate returns English city/sub-city mapping.
 * Usage: node scripts/e2e-map-pin-locate-check.mjs [API_BASE]
 * Default API_BASE http://127.0.0.1:18080/api/v1
 */
const base = (process.argv[2] || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const pin = { latitude: 8.941409, longitude: 38.738491 };

const res = await fetch(`${base}/geo/locate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(pin),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("E2E_FAIL locate status", res.status, body);
  process.exit(1);
}
const loc = body.location || {};
const cc = String(loc.country_code || "").toUpperCase();
const region = String(loc.region || "").trim();
const city = String(loc.city || "").trim();
if (cc !== "ET") {
  console.error("E2E_FAIL country", cc, body);
  process.exit(1);
}
if (!/addis/i.test(region)) {
  console.error("E2E_FAIL region (want Addis…)", region, body);
  process.exit(1);
}
if (!city) {
  console.error("E2E_FAIL city/sub-city empty", body);
  process.exit(1);
}
// Reject Amharic script in labels
if (/[\u1200-\u137F]/.test(region + city)) {
  console.error("E2E_FAIL Amharic in labels", { region, city });
  process.exit(1);
}
console.log("E2E_PASS map pin locate", { country_code: cc, region, city });
