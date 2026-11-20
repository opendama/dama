import { spawnSync } from "node:child_process";
import fs from "node:fs";
/**
 * Guest auth-gate smoke. Needs api :8080, admin :3001, web :3000.
 * Client checks use chrome-headless-shell when PLAYWRIGHT_CHROME / CHROME_PATH is set,
 * or the Cursor sandbox playwright chromium path.
 */
import http from "node:http";
import os from "node:os";
import path from "node:path";

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (r) => {
        let body = "";
        r.on("data", (c) => {
          body += c;
        });
        r.on("end", () => resolve({ status: r.statusCode || 0, body }));
      })
      .on("error", reject);
  });
}

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

function findChrome() {
  const env = process.env.PLAYWRIGHT_CHROME || process.env.CHROME_PATH || "";
  if (env && fs.existsSync(env)) return env;
  const root = path.join(os.tmpdir(), "cursor-sandbox-cache");
  if (!fs.existsSync(root)) return "";
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === "chrome-headless-shell.exe") return full;
      if (e.isDirectory()) stack.push(full);
    }
  }
  return "";
}

function dumpDom(chrome, url, budgetMs = 20000) {
  const r = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      `--virtual-time-budget=${budgetMs}`,
      `--timeout=${budgetMs + 10000}`,
      "--dump-dom",
      url,
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  return `${r.stdout || ""}\n${r.stderr || ""}`;
}

const api = await get("http://127.0.0.1:8080/api/v1/public/auth-providers");
const p = JSON.parse(api.body);
ok(
  "api_admin_login_title",
  (p.admin_login_title || "").trim() === "Console sign in",
  p.admin_login_title,
);
ok(
  "api_login_subtitle",
  (p.login_subtitle || "").includes("Social sign-in only"),
  p.login_subtitle,
);
ok(
  "api_google_action",
  (p.items?.[0]?.action_label || "").includes("Google"),
  p.items?.[0]?.action_label,
);
ok("api_path_login", (p.site?.path_login || "") === "/auth/login", p.site?.path_login);

const adminDash = await get("http://127.0.0.1:3001/dashboard");
ok("admin_dash_ssr_200", adminDash.status === 200, String(adminDash.status));
ok("admin_dash_no_h1_control_console", !/<h1[^>]*>\s*Control console/i.test(adminDash.body));
ok("admin_dash_no_absolute_crud_body", !/Absolute CRUD control/i.test(adminDash.body));

const adminLogin = await get("http://127.0.0.1:3001/auth/login");
ok("admin_login_ssr_200", adminLogin.status === 200, String(adminLogin.status));
ok("admin_login_no_absolute_crud_body", !/Absolute CRUD control/i.test(adminLogin.body));

const webDash = await get("http://127.0.0.1:3000/dashboard");
ok("web_dash_ssr_200", webDash.status === 200, String(webDash.status));
ok("web_dash_no_absolute_crud", !/Absolute CRUD control/i.test(webDash.body));

const chrome = findChrome();
if (!chrome) {
  ok("client_chrome_available", false, "chrome-headless-shell not found");
} else {
  ok("client_chrome_available", true, chrome);
  const loginDom = dumpDom(chrome, "http://127.0.0.1:3001/auth/login", 20000);
  ok("admin_login_h1_console_sign_in", /Console sign in/i.test(loginDom));
  ok("admin_login_continue_google", /Continue with Google/i.test(loginDom));
  ok("admin_login_social_subtitle", /Social sign-in only/i.test(loginDom));
  ok("admin_login_no_absolute_crud", !/Absolute CRUD control/i.test(loginDom));

  const dashDom = dumpDom(chrome, "http://127.0.0.1:3001/dashboard", 25000);
  ok(
    "admin_dash_redirects_to_social_login",
    /Console sign in/i.test(dashDom) && /Continue with Google/i.test(dashDom),
  );
  ok("admin_dash_guest_no_absolute_crud", !/Absolute CRUD control/i.test(dashDom));

  const webDom = dumpDom(chrome, "http://127.0.0.1:3000/dashboard", 25000);
  ok(
    "web_dash_redirects_to_social_login",
    /Continue with Google/i.test(webDom) && /Social sign-in only|Sign in with Google/i.test(webDom),
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
