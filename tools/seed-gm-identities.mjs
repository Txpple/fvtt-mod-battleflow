/**
 * THE MULTI-GM IDENTITIES: the world users a run's `GM_CLIENTS` may name beside the suite identity
 * (target.mjs `GM_IDENTITIES`) — `gm2`, a Gamemaster (role 4, FOUNDRY_GM2_USER), and `assistant`, an
 * Assistant GM (role 3, FOUNDRY_ASSISTANT_USER) — created with the role each is for and the password
 * the family .env gives it. Joins as the suite identity, alone (the sole-GM preflight).
 * A prod mirror (`pull-prod-to-local.mjs` in the MCP repo) replaces the sandbox's users with prod's,
 * so these users are gone after every mirror: run this once after each one.
 *
 *   node tools/seed-gm-identities.mjs            create what is missing; report what stands
 *   node tools/seed-gm-identities.mjs --check    report only, create nothing
 *
 * Foundry lets a user create a user of its own role or below (BaseUser's create test), so a suite
 * identity with the Assistant GM role creates the Assistant and NAMES the Gamemaster it cannot create:
 * that one is made from a Gamemaster's window (Configure Players, Create User: the name and password
 * the .env gives, the Gamemaster role). An existing user is left as it is; one holding another role is
 * named. The report gives each identity's user, role and id (the elect breaks a tie of roles on the
 * lower id), the suite identity's role, and which roles the world lets modify settings. Passwords are
 * never printed.
 * Exit 0 when every identity the .env names stands with its role; 1 when one does not.
 */
import { fileURLToPath } from "node:url";
import { strictArgs, usageOf } from "./args.mjs";
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";
import { GM_IDENTITIES, gmIdentity } from "./target.mjs";

const TAG = "seed-gm-identities";
const { values } = strictArgs({
  options: { check: { type: "boolean" } },
  usage: usageOf(fileURLToPath(import.meta.url)),
  script: "seed-gm-identities.mjs"
});
const env = loadEnv();
const wanted = Object.keys(GM_IDENTITIES).filter(k => k !== "suite").map(k => gmIdentity(env, k)).filter(Boolean);
const unnamed = Object.keys(GM_IDENTITIES).filter(k => (k !== "suite") && !gmIdentity(env, k));
for (const k of unnamed) console.log(`[${TAG}] ${k}: the .env names no user (${GM_IDENTITIES[k].user[0]}) — skipped`);
if (!wanted.length) { console.log(`[${TAG}] nothing to seed`); process.exit(0); }

const f = await connectSuite({ tag: TAG, watchdogMs: 120_000, requireElect: false, env });
const out = await f.evaluate(async ({ want, dry }) => {
  const UserClass = getDocumentClass("User");
  const me = { name: game.user.name, role: game.user.role, id: game.user.id };
  const rows = [];
  for (const w of want) {
    const row = { key: w.key, user: w.user, wantRole: w.role };
    const existing = game.users.getName(w.user);
    if (existing) {
      Object.assign(row, { exists: true, role: existing.role, id: existing.id, ok: existing.role === w.role });
      if (!row.ok) row.note = `holds role ${existing.role}, not ${w.role}: change it from a Gamemaster's window, or name another user`;
    } else if (dry) {
      Object.assign(row, { exists: false, ok: false, note: "missing" });
    } else if (game.user.role < w.role) {
      Object.assign(row, { exists: false, ok: false,
        note: `this client is role ${game.user.role} and Foundry lets a user create users of its own role or below: `
          + `create "${w.user}" with role ${w.role} from a Gamemaster's window, with the .env's password` });
    } else {
      try {
        const [made] = await UserClass.createDocuments([{ name: w.user, role: w.role, password: w.password ?? "" }]);
        Object.assign(row, { exists: true, created: true, role: made.role, id: made.id, ok: made.role === w.role });
      } catch (err) {
        Object.assign(row, { exists: false, ok: false, note: `the create was refused: ${err?.message ?? err}` });
      }
    }
    rows.push(row);
  }
  return { me, settingsRoles: game.permissions?.SETTINGS_MODIFY ?? null, filesUploadRoles: game.permissions?.FILES_UPLOAD ?? null, rows };
}, { want: wanted.map(w => ({ key: w.key, user: w.user, role: w.role, password: w.password ?? null })), dry: !!values.check });
await disposeSafely(f, TAG);

console.log(`[${TAG}] the suite identity "${out.me.name}" is role ${out.me.role} (id ${out.me.id})`);
console.log(`[${TAG}] the world's SETTINGS_MODIFY roles: ${JSON.stringify(out.settingsRoles)}; FILES_UPLOAD roles: ${JSON.stringify(out.filesUploadRoles)}`);
for (const r of out.rows) {
  const state = r.created ? "CREATED" : r.exists ? "stands" : "MISSING";
  console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.key.padEnd(10)} "${r.user}" ${state}${r.exists ? `, role ${r.role}, id ${r.id}` : ""}${r.note ? ` — ${r.note}` : ""}`);
}
process.exit(out.rows.every(r => r.ok) ? 0 : 1);
