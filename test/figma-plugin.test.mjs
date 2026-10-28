// Runs the bundled plugin (figma-plugin/dist/code.js) against an in-memory fake of the Figma Variables API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeFigma } from "./fake-figma.mjs";
import { createBundle } from "../src/core/bundle.mjs";
import { applyFlat, indexTree, toFlat } from "../src/core/tokens.mjs";
import { starterConfig, starterTree } from "./helpers.mjs";

const starterBundle = () => createBundle({ kind: "tree", tokens: starterTree(), config: starterConfig() });

test("import creates the Figma layout: collections, modes, headings, scopes and aliases", async () => {
  const f = fakeFigma();
  const result = await f.send({ type: "import", bundle: starterBundle() });
  assert.equal(result.result.ok, true, JSON.stringify(result));
  assert.deepEqual(f.collections.map((c) => c.name), ["Primitive", "Semantic", "Components"]);
  assert.deepEqual(f.collections.map((c) => c.modes.map((m) => m.name)), [["Mode 1"], ["light", "dark"], ["Value"]]);
  const byName = (n) => f.all().find((v) => v.name === n);
  const plain = (x) => JSON.parse(JSON.stringify(x)); // values from the plugin's vm realm
  const blue = byName("color/blue/500");
  assert.equal(blue.resolvedType, "COLOR");
  assert.equal(blue.hiddenFromPublishing, true, "primitives are hidden from publishing");
  assert.equal(byName("spacing/md").valuesByMode[f.collections[1].modes[0].modeId].type, "VARIABLE_ALIAS");
  assert.equal(result.result.unmapped, 0, "every token becomes a variable");
  assert.deepEqual(result.result.broken, []);

  // Headings and divider variables structure the panel, as in the reference file.
  const names = f.all().map((v) => v.name);
  assert.equal(names[0], "𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ");
  assert.ok(names.includes("color/𝗥𝗢𝗟𝗘/primary/default"), "semantic colours sit in their section");
  assert.ok(names.indexOf("color/𝗥𝗢𝗟𝗘/ㅤ") < names.indexOf("color/𝗥𝗢𝗟𝗘/primary/default"));
  assert.ok(names.includes("button/bg-primary-default"), "component names are joined after the component");
  const divider = byName("𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ");
  assert.deepEqual(plain([divider.scopes, divider.hiddenFromPublishing]), [[], true]);
  assert.deepEqual(plain(byName("spacing/md").scopes), ["ALL_SCOPES"]);
  assert.ok(byName("space/600").scopes.includes("GAP"));

  // Shadows become one variable per layer and field; opacity is shown in percent.
  assert.equal(byName("shadow/sm/layer-0/blur").resolvedType, "FLOAT");
  assert.equal(byName("shadow/sm/layer-0/color").resolvedType, "COLOR");
  const easing = byName("motion/easing/standard");
  assert.equal(easing.resolvedType, "STRING");
  assert.equal(easing.valuesByMode[f.collections[0].modes[0].modeId], "[0.2,0,0,1]");
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
  v.scopes = ["GAP"];
  for (const m of semantic.modes) v.setValueForMode(m.modeId, f.figma.variables.createVariableAlias(target));
  v.description = "Hero section inset.";
  const exported = await f.send({ type: "export" });
  assert.deepEqual(exported.created, ["spacing.xxl"]);
  assert.equal(exported.bundle.tokens["spacing.xxl"].value, "{space.600}");
});
