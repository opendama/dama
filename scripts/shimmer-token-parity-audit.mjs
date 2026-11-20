/**
 * Fail-closed: admin / web / Flutter shimmer must match.
 * Canonical: admin `.dama-shimmer` + `--dama-track` / `--dama-shimmer-via`.
 * Run: node scripts/shimmer-token-parity-audit.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fails = [];
const ok = [];

function read(rel) {
  return readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else fails.push(msg);
}

function extractShimmerCss(css) {
  const m = css.match(/@keyframes dama-shimmer-wave[\s\S]*?\.dama-shimmer::after\s*\{[\s\S]*?\n\}/);
  return m ? m[0].trim() : "";
}

const adminCss = read("apps/admin/src/app/globals.css");
const webCss = read("apps/web/src/app/globals.css");
const adminSk = read("apps/admin/src/components/ui/shimmer-skeletons.tsx");
const webSk = read("apps/web/src/components/ui/shimmer-skeletons.tsx");
const flutterSk = read("apps/mobile/lib/core/ui/shimmer_skeletons.dart");

const trackRe = /--dama-track:\s*hsl\(var\(--muted\)\);/g;
const viaRe = /--dama-shimmer-via:\s*hsl\(var\(--muted-foreground\)\s*\/\s*0\.06\);/g;

assert((adminCss.match(trackRe) || []).length >= 2, "admin track muted x2");
assert((webCss.match(trackRe) || []).length >= 2, "web track muted x2");
assert((adminCss.match(viaRe) || []).length >= 2, "admin shimmer-via mf/0.06 x2");
assert((webCss.match(viaRe) || []).length >= 2, "web shimmer-via mf/0.06 x2");
assert(!adminCss.includes("--dama-shimmer:"), "admin: no legacy --dama-shimmer var");
assert(!webCss.includes("--dama-shimmer:"), "web: no legacy --dama-shimmer var");
assert(adminCss.includes("var(--dama-shimmer-via) 50%"), "admin ::after uses shimmer-via");
assert(webCss.includes("var(--dama-shimmer-via) 50%"), "web ::after uses shimmer-via");

const adminBlock = extractShimmerCss(adminCss);
const webBlock = extractShimmerCss(webCss);
assert(adminBlock.length > 80, "admin shimmer CSS block extracted");
assert(webBlock === adminBlock, "web shimmer CSS block === admin (byte-identical)");

assert(adminSk.includes('cn("dama-shimmer", className)'), "admin ShimmerBlock");
assert(webSk.includes('cn("dama-shimmer", className)'), "web ShimmerBlock");
assert(!adminSk.includes("before:via"), "admin no Tailwind via");
assert(!webSk.includes("before:via"), "web no Tailwind via");
assert(!webSk.includes("opacity-40"), "web no board opacity tint");

assert(flutterSk.includes("Color(0xFFF4F4F5)"), "flutter light track #F4F4F5");
assert(flutterSk.includes("Color(0xFF27272A)"), "flutter dark track #27272A");
assert(flutterSk.includes("Color(0xFF71717A)"), "flutter light via #71717A");
assert(flutterSk.includes("Color(0xFFA1A1AA)"), "flutter dark via #A1A1AA");
assert(flutterSk.includes("withValues(alpha: 0.06)"), "flutter via alpha 0.06");
assert(flutterSk.includes("milliseconds: 1600"), "flutter 1.6s");
assert(flutterSk.includes("stops: const [0.0, 0.5, 1.0]"), "flutter Trim stops");
assert(!flutterSk.includes("damaColorsOf(context).bone"), "flutter track not theme bone");
assert(!flutterSk.includes("onSurfaceMuted.withValues"), "flutter via not theme onSurfaceMuted");

console.log(`PASS ${ok.length}`);
for (const m of ok) console.log(`  ✓ ${m}`);
if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  for (const m of fails) console.error(`  ✗ ${m}`);
  process.exit(1);
}
console.log("shimmer-token-parity-audit: OK");
