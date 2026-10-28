import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = new URL("../bin/token-kit.mjs", import.meta.url).pathname;
const run = (cwd, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

function project() {
  const cwd = mkdtempSync(join(tmpdir(), "token-kit-"));
  assert.equal(run(cwd, "init").status, 0);
  assert.equal(run(cwd, "build").status, 0);
  return cwd;
}

test("init, build and check pass on the starter", () => {
  const cwd = project();
  assert.equal(run(cwd, "build", "--check").status, 0);
  assert.equal(run(cwd, "report", "--check").status, 0);
  const result = run(cwd, "check");
  assert.equal(result.status, 0, result.stdout);
  assert.match(readFileSync(join(cwd, "src/styles/tokens/tokens.css"), "utf8"), /--button-radius: var\(--radius-control\);/);
});

test("source audit flags literals, tier bypass and unknown vars; ratchet freezes reviews", () => {
  const cwd = project();
  mkdirSync(join(cwd, "src/components"), { recursive: true });
  writeFileSync(
    join(cwd, "src/components/Card.module.css"),
    `.card {\n  --_inset: calc(var(--space-gutter) * 2);\n  padding: var(--_inset);\n  color: #333;\n  margin-top: 12px;\n  background: var(--palette-neutral-0);\n  border-color: var(--does-not-exist);\n}\n`,
  );
  writeFileSync(join(cwd, "src/components/Card.tsx"), `export const Card = () => <div className="p-[13px] bg-[#fff]" style={{ padding: 8, color: "#ff0000" }} />;\n`);
  const result = run(cwd, "check", "--json");
  assert.equal(result.status, 1);
  const rules = JSON.parse(result.stdout).findings.map((f) => `${f.rule}:${f.line}`);
  for (const expected of [
    "TOKEN_SOURCE_COLOR:4",
    "TOKEN_SOURCE_LENGTH:5",
    "TOKEN_SOURCE_TIER_BYPASS:6",
    "TOKEN_SOURCE_UNKNOWN_VAR:7",
    "TOKEN_SOURCE_TAILWIND_ARBITRARY:1",
  ])
    assert.ok(rules.includes(expected), `${expected} in ${rules}`);
  assert.ok(!rules.some((r) => r.startsWith("TOKEN_SOURCE_UNKNOWN_VAR:3")), "local custom property is known");

  // Freeze everything deliberately, then the gate passes; fixing a finding makes report --check demand a shrink.
  assert.equal(run(cwd, "report", "--accept-new").status, 0);
  assert.equal(run(cwd, "check").status, 0);
  writeFileSync(join(cwd, "src/components/Card.tsx"), `export const Card = () => <div />;\n`);
  assert.equal(run(cwd, "check").status, 0);
  assert.equal(run(cwd, "report", "--check").status, 1);
  assert.equal(run(cwd, "report").status, 0);
  assert.equal(run(cwd, "report", "--check").status, 0);
});

test("export and import round trip between two projects", () => {
  const a = project();
  const tokens = readJson(join(a, "tokens/tokens.json"));
  tokens.foundations.palette.brand["500"].$value = "#1E40AF";
  writeFileSync(join(a, "tokens/tokens.json"), JSON.stringify(tokens, null, 2));
  assert.equal(run(a, "export", "--out", "out.tokens.bundle.json").status, 0);
  const bundle = readJson(join(a, "out.tokens.bundle.json"));
  assert.equal(bundle.kind, "tree");
  assert.match(bundle.checksum, /^sha256:/);

  const b = project();
  const dry = run(b, "import", join(a, "out.tokens.bundle.json"));
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /\| Changed \| 1 \|/);
  assert.match(dry.stdout, /Dry run/);
  assert.notEqual(readJson(join(b, "tokens/tokens.json")).foundations.palette.brand["500"].$value, "#1E40AF");
  assert.equal(run(b, "import", join(a, "out.tokens.bundle.json"), "--apply").status, 0);
  assert.deepEqual(readJson(join(b, "tokens/tokens.json")), tokens);
});

test("import refuses non-conform bundles and unapproved new tokens", () => {
  const a = project();
  const tokens = readJson(join(a, "tokens/tokens.json"));
  tokens.color.text.default.$value = "{palette.neutral.200}"; // fails contrast
  writeFileSync(join(a, "tokens/tokens.json"), JSON.stringify(tokens));
  run(a, "export", "--out", "bad.json");
  const b = project();
  const bad = run(b, "import", join(a, "bad.json"), "--apply");
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /TOKEN_CONTRAST/);

  tokens.color.text.default.$value = "{palette.neutral.900}";
  tokens.card["shadow-color"] = { $type: "color", $value: "{color.border.default}", $description: "Card shadow." };
  writeFileSync(join(a, "tokens/tokens.json"), JSON.stringify(tokens));
  run(a, "export", "--out", "new.json");
  assert.equal(run(b, "import", join(a, "new.json"), "--apply").status, 2);
  assert.equal(run(b, "import", join(a, "new.json"), "--apply", "--accept-new-tokens").status, 0);
  assert.equal(readJson(join(b, "tokens/tokens.json")).card["shadow-color"].$value, "{color.border.default}");

  const tampered = readJson(join(a, "new.json"));
  tampered.tokens.card.radius.$value = "{radius.pill}";
  writeFileSync(join(a, "tampered.json"), JSON.stringify(tampered));
  assert.match(run(b, "import", join(a, "tampered.json")).stderr, /checksum mismatch/);
});

test("custom output formats plug in via the config", () => {
  const cwd = project();
  writeFileSync(
    join(cwd, "my-format.mjs"),
    `export default { name: "mine", files: ({ index }) => [{ path: "count.txt", content: String(index.tokens.size) }] };\n`,
  );
  const config = readJson(join(cwd, "token-kit.config.json"));
  config.formats = ["css-variables", "tailwind-v4", "./my-format.mjs"];
  writeFileSync(join(cwd, "token-kit.config.json"), JSON.stringify(config));
  assert.equal(run(cwd, "build").status, 0);
  assert.ok(Number(readFileSync(join(cwd, "src/styles/tokens/count.txt"), "utf8")) > 50);
  assert.match(readFileSync(join(cwd, "src/styles/tokens/tailwind.theme.css"), "utf8"), /--color-tk-text-default: var\(--color-text-default\);/);
});
