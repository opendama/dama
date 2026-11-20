/**
 * E2E: users.country_code persistence + public payloads for Chess.com-style flags.
 * Requires API (default :18080) with DAMA_ALLOW_E2E_AUTH=1 for stub sessions.
 * Locate uses server IP invent on localhost (no client country_code).
 */
const API = (process.env.DAMA_API_URL || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");

async function json(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("API", API);
  const stamp = Date.now().toString(36);
  const { res: sessRes, body: sess } = await json("/auth/e2e/session", {
    method: "POST",
    body: JSON.stringify({
      username: `flag_${stamp}`,
      email: `flag_${stamp}@example.test`,
    }),
  });
  if (sessRes.status === 404 || sessRes.status === 403) {
    console.log(
      "SKIP e2e session (DAMA_ALLOW_E2E_AUTH off) - checking UpdateLocation via public shape only",
    );
    const { res: chromeRes } = await json("/public/play-rail-chrome");
    assert(chromeRes.ok, "play-rail-chrome");
    console.log("OK chrome available; enable DAMA_ALLOW_E2E_AUTH for full country write path");
    console.log("E2E_COUNTRY_FLAGS_PARTIAL");
    return;
  }
  assert(sessRes.ok, `e2e session ${sessRes.status} ${JSON.stringify(sess)}`);
  const token = sess.access_token;
  assert(token, "access_token");
  const userId = sess.user?.id;
  assert(userId, "user id");

  const { res: locRes, body: loc } = await json("/geo/locate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  assert(locRes.ok, `locate ${locRes.status} ${JSON.stringify(loc)}`);
  assert(
    (loc.location?.country_code || "").toUpperCase() === "ET",
    `locate returned ${JSON.stringify(loc.location)}`,
  );

  const { res: meRes, body: me } = await json("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(meRes.ok, `me ${meRes.status}`);
  const cc = (me.user?.country_code || "").toUpperCase();
  assert(cc === "ET", `users.country_code after locate want ET got ${cc}`);

  const gqlUrl = API.replace(/\/api\/v1$/, "/graphql");
  const gqlRes = await fetch(gqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: "query Me { me { id username countryCode } }",
    }),
  });
  const gqlText = await gqlRes.text();
  let gqlBody = null;
  try {
    gqlBody = gqlText ? JSON.parse(gqlText) : null;
  } catch {
    gqlBody = gqlText;
  }
  assert(gqlRes.ok, `graphql me ${gqlRes.status} ${gqlText}`);
  const gqlCc = (gqlBody?.data?.me?.countryCode || "").toUpperCase();
  assert(gqlCc === "ET", `GraphQL me.countryCode want ET got ${gqlCc}`);

  const { res: playerRes, body: player } = await json(`/players/${userId}`);
  assert(playerRes.ok, `players/${userId}`);
  const pcc = (player.player?.country_code || "").toUpperCase();
  assert(pcc === "ET", `GET /players country_code want ET got ${pcc}`);

  const { res: flagChromeRes, body: flagChrome } = await json("/public/country-flag-chrome");
  assert(flagChromeRes.ok, `country-flag-chrome ${flagChromeRes.status}`);
  const tmpl = (flagChrome.image_url_template || "").trim();
  assert(tmpl.includes("{code}"), `image_url_template missing {code}: ${tmpl}`);
  const { res: railRes, body: rail } = await json("/public/play-rail-chrome");
  assert(railRes.ok, "play-rail-chrome");
  assert(
    (rail.country_flag_image_url_template || "").includes("{code}"),
    "play_rail country_flag_image_url_template",
  );

  const flagUrl = tmpl.replaceAll("{code}", pcc.toLowerCase());
  const flagRes = await fetch(flagUrl);
  assert(flagRes.ok, `flag image ${flagUrl} ${flagRes.status}`);
  const ctype = (flagRes.headers.get("content-type") || "").toLowerCase();
  assert(ctype.includes("image"), `flag content-type ${ctype}`);

  console.log("OK locate?users.country_code ET");
  console.log("OK GraphQL me.countryCode ET");
  console.log("OK GET /players exposes country_code");
  console.log("OK DB country-flag-chrome template", tmpl);
  console.log("OK colored flag image", flagUrl);
  console.log("E2E_COUNTRY_FLAGS_COMPLETE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
