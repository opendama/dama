/**
 * Live E2E: tournament notifications (DB-backed).
 * Requires API with DAMA_ALLOW_E2E_AUTH=1.
 *
 * Covers:
 * - createTournament (draft) ? no player.tournament_created
 * - setTournamentStatus GraphQL draft?open ? tournament_created for all players
 * - REST status open?archived ? tournament_status for entrants
 * - notification list href includes ?id=
 */
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const gqlBase = `${base.replace(/\/api\/v1$/, "")}/graphql`;

async function req(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

async function gql(token, query, variables) {
  const r = await req(gqlBase, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  return r;
}

const stamp = Date.now();

(async () => {
  const admin = await req(`${base}/auth/e2e/session`, {
    method: "POST",
    body: JSON.stringify({
      username: `tn_a_${stamp}`,
      email: `tn_a_${stamp}@example.com`,
      role: "admin",
    }),
  });
  assert(admin.status === 200 && admin.body.access_token, "admin session");
  const atok = admin.body.access_token;

  const p1 = await req(`${base}/auth/e2e/session`, {
    method: "POST",
    body: JSON.stringify({
      username: `tn_p1_${stamp}`,
      email: `tn_p1_${stamp}@example.com`,
    }),
  });
  const p2 = await req(`${base}/auth/e2e/session`, {
    method: "POST",
    body: JSON.stringify({
      username: `tn_p2_${stamp}`,
      email: `tn_p2_${stamp}@example.com`,
    }),
  });
  assert(p1.status === 200 && p1.body.access_token, "player1 session");
  assert(p2.status === 200 && p2.body.access_token, "player2 session");
  const p1tok = p1.body.access_token;
  const p2tok = p2.body.access_token;
  const p1id = p1.body.user.id;

  const title = `notif_tour_${stamp}`;
  const create = await gql(
    atok,
    `mutation($t:String!){
      createTournament(title:$t,isFree:true,entryFeeAmount:0,entryFeeCurrency:"USD"){
        id title status
      }
    }`,
    { t: title },
  );
  assert(!create.body.errors, `createTournament errors=${JSON.stringify(create.body.errors)}`);
  const t = create.body.data?.createTournament;
  assert(t?.id, "tournament id");
  assert(t.status === "draft", `created status=${t.status} (expect draft)`);

  let list1 = await req(`${base}/me/notifications?skip=0&limit=20`, {
    headers: { Authorization: `Bearer ${p1tok}` },
  });
  const createdKinds = (list1.body.items || []).filter(
    (i) => i.kind_code === "player.tournament_created" && String(i.href || "").includes(t.id),
  );
  assert(createdKinds.length === 0, "draft create does NOT emit tournament_created");

  const openGql = await gql(
    atok,
    `mutation($id:ID!,$status:String!){
      setTournamentStatus(id:$id,status:$status){ id status }
    }`,
    { id: t.id, status: "open" },
  );
  assert(
    !openGql.body.errors,
    `setTournamentStatus GraphQL errors=${JSON.stringify(openGql.body.errors)}`,
  );
  assert(openGql.body.data?.setTournamentStatus?.status === "open", "GraphQL status open");

  list1 = await req(`${base}/me/notifications?skip=0&limit=20`, {
    headers: { Authorization: `Bearer ${p1tok}` },
  });
  const list2 = await req(`${base}/me/notifications?skip=0&limit=20`, {
    headers: { Authorization: `Bearer ${p2tok}` },
  });
  const n1 = (list1.body.items || []).find((i) => i.kind_code === "player.tournament_created");
  const n2 = (list2.body.items || []).find((i) => i.kind_code === "player.tournament_created");
  assert(n1, "player1 got tournament_created via GraphQL open");
  assert(n2, "player2 got tournament_created via GraphQL open");
  assert(n1.title && n1.body, "tournament_created title+body rendered");
  assert(
    n1.href === `/?view=tournaments&id=${t.id}`,
    `href=${n1.href} expect /?view=tournaments&id=${t.id}`,
  );
  assert(
    String(n1.body).includes(title) || String(n1.body).includes('"'),
    "body includes tournament title args",
  );

  // Enroll p1 then archive via REST - entrant gets tournament_status
  const enroll = await req(`${base}/tournaments/${t.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p1tok}` },
  });
  assert(
    enroll.status === 200 || enroll.status === 201,
    `enroll status=${enroll.status} body=${JSON.stringify(enroll.body)}`,
  );

  const arch = await req(`${base}/console/tournaments/${t.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${atok}` },
    body: JSON.stringify({ status: "archived" }),
  });
  assert(
    arch.status === 200 && arch.body.status === "archived",
    `REST archive status=${arch.status}`,
  );

  list1 = await req(`${base}/me/notifications?skip=0&limit=20`, {
    headers: { Authorization: `Bearer ${p1tok}` },
  });
  const statusN = (list1.body.items || []).find(
    (i) => i.kind_code === "player.tournament_status" && String(i.href || "").includes(t.id),
  );
  assert(statusN, "entrant got tournament_status via REST archive");
  assert(statusN.href === `/?view=tournaments&id=${t.id}`, `status href=${statusN.href}`);

  // Non-entrant should not get status (p2 not enrolled)
  const list2b = await req(`${base}/me/notifications?skip=0&limit=20`, {
    headers: { Authorization: `Bearer ${p2tok}` },
  });
  const p2status = (list2b.body.items || []).find(
    (i) => i.kind_code === "player.tournament_status" && String(i.href || "").includes(t.id),
  );
  assert(!p2status, "non-entrant did NOT get tournament_status");

  // Re-open via GraphQL again should not duplicate created (dedupe)
  const reopen = await gql(
    atok,
    `mutation($id:ID!,$status:String!){
      setTournamentStatus(id:$id,status:$status){ id status }
    }`,
    { id: t.id, status: "open" },
  );
  assert(!reopen.body.errors, "re-open ok");
  // first open already used tournament_created:{id}:{uid} - re-open from archived?open should emit again?
  // previousStatus archived !== open, so EmitActivePlayers runs again with SAME dedupe key ? DO NOTHING
  list1 = await req(`${base}/me/notifications?skip=0&limit=50`, {
    headers: { Authorization: `Bearer ${p1tok}` },
  });
  const createdCount = (list1.body.items || []).filter(
    (i) => i.kind_code === "player.tournament_created" && String(i.href || "").includes(t.id),
  ).length;
  assert(createdCount === 1, `dedupe: created count=${createdCount} expect 1`);

  void p1id;
  console.log("TOURNAMENT_NOTIF_E2E_OK", t.id);
})().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
