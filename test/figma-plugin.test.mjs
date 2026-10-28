// Runs the bundled plugin (figma-plugin/dist/code.js) against an in-memory fake of the Figma Variables API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeFigma } from "./fake-figma.mjs";
import { createBundle } from "../src/core/bundle.mjs";
import { applyFlat, indexTree, toFlat } from "../src/core/tokens.mjs";
import { starterConfig, starterTree } from "./helpers.mjs";

const starterBundle = () => createBundle({ kind: "tree", tokens: starterTree(), config: starterConfig() });

test("import creates one collection per tier with Light/Dark modes and aliases", async () => {
  const f = fakeFigma();
  const result = await f.send({ type: "import", bundle: starterBundle() });
  assert.equal(result.result.ok, true, JSON.stringify(result));
  assert.deepEqual(f.collections.map((c) => c.name), ["Foundation Collection", "Alias Collection", "Control Collection"]);
  assert.deepEqual(f.collections[1].modes.map((m) => m.name), ["Light", "Dark"]);
  const byName = (n) => f.all().find((v) => v.name === n);
  assert.equal(byName("color/blue/500").resolvedType, "COLOR");
  assert.equal(byName("spacing/md").valuesByMode[f.collections[1].modes[0].modeId].type, "VARIABLE_ALIAS");
  assert.equal(result.result.unmapped, 0, "every token becomes a variable");
  const easing = byName("motion/easing/standard");
  assert.equal(easing.resolvedType, "STRING");
  assert.equal(easing.valuesByMode[f.collections[0].modes[0].modeId], "[0.2,0,0,1]");
  assert.equal(byName("motion/easing/default").resolvedType, "STRING", "aliases of text tokens stay aliases");
});

test("composite values are editable as text and validated on export", async () => {
  const f = fakeFigma();
  await f.send({ type: "import", bundle: starterBundle() });
  const easing = f.all().find((v) => v.name === "motion/easing/standard");
  const mode = f.collections[0].modes[0].modeId;
  easing.setValueForMode(mode, "[0.4, 0, 0.2, 1]");
  let exported = await f.send({ type: "export" });
  assert.deepEqual(exported.bundle.tokens["motion.easing.standard"].value, [0.4, 0, 0.2, 1]);
  easing.setValueForMode(mode, "[0.4, 0, 0.2, 1");
  exported = await f.send({ type: "export" });
  assert.equal(exported.blocked, true);
  assert.equal(exported.findings[0].rule, "TOKEN_FIGMA_VALUE");
});

test("check is clean after import and export round-trips losslessly", async () => {
  const f = fakeFigma();
  await f.send({ type: "import", bundle: starterBundle() });
  const checked = await f.send({ type: "check" });
  assert.equal(checked.errors, 0, JSON.stringify(checked.findings, null, 1));
  const exported = await f.send({ type: "export" });
  assert.equal(exported.type, "exported");
  assert.equal(exported.bundle.kind, "flat");
  const config = starterConfig();
  const original = toFlat(indexTree(starterTree(), config));
  assert.deepEqual(exported.bundle.tokens, original);
  assert.deepEqual(applyFlat(starterTree(), exported.bundle.tokens, config).tree, starterTree());
});

test("a global change is exported; a non-conform change blocks the export", async () => {
  const f = fakeFigma();
  await f.send({ type: "import", bundle: starterBundle() });
  const light = (v) => f.collections.find((c) => c.id === v.variableCollectionId).modes[0].modeId;
  const blue = f.all().find((v) => v.name === "color/blue/500");
  blue.setValueForMode(light(blue), { r: 0.1, g: 0.2, b: 0.6, a: 1 });
  let exported = await f.send({ type: "export" });
  assert.equal(exported.type, "exported");
  assert.equal(exported.bundle.tokens["color.blue.500"].value, "#1A3399");

  const brand = f.all().find((v) => v.name === "color/lemon/500");

  brand.setValueForMode(light(brand), { r: 0.1, g: 0.1, b: 0.12, a: 1 }); // dark text on near-black
  exported = await f.send({ type: "export" });
  assert.equal(exported.type, "checked");
  assert.equal(exported.blocked, true);
  assert.ok(exported.findings.some((x) => x.rule === "TOKEN_CONTRAST"));
});

test("variables created in Figma are reported as new tokens", async () => {
  const f = fakeFigma();
  await f.send({ type: "import", bundle: starterBundle() });
  const semantic = f.collections[1];
  const target = f.all().find((v) => v.name === "space/600");
  const v = f.figma.variables.createVariable("spacing/xxl", semantic, "FLOAT");
  for (const m of semantic.modes) v.setValueForMode(m.modeId, f.figma.variables.createVariableAlias(target));
  v.description = "Hero section inset.";
  const exported = await f.send({ type: "export" });
  assert.deepEqual(exported.created, ["spacing.xxl"]);
  assert.equal(exported.bundle.tokens["spacing.xxl"].value, "{space.600}");
});
