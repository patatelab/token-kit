// The Figma layout against the reference file ds-3tier-v2 (test/fixtures/ds-3tier-v2.variables.tsv):
// the kit reads the file, checks it and writes the same variables back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readVariablesTsv, writeVariablesTsv } from "./figma-fixture.mjs";
import { fakeFigma } from "./fake-figma.mjs";
import { resolveConfig } from "../src/core/config.mjs";
import { checkModel, indexFlat } from "../src/core/rules.mjs";
import { applyFlat, indexTree, toFlat } from "../src/core/tokens.mjs";
import { boldText, figmaNameOf, fromFigmaSpecs, isDividerName, pathOfFigmaName, toFigmaSpecs } from "../src/core/figma-layout.mjs";

const fixture = fileURLToPath(new URL("./fixtures/ds-3tier-v2.variables.tsv", import.meta.url));
const config = resolveConfig({});

const countBy = (findings) => findings.reduce((acc, f) => ({ ...acc, [f.rule]: (acc[f.rule] ?? 0) + 1 }), {});

test("names: headings, sections and joined component names", () => {
  assert.equal(boldText("ROLE"), "𝗥𝗢𝗟𝗘");
  assert.equal(figmaNameOf(config, "semantic", "color.primary.default"), "color/𝗥𝗢𝗟𝗘/primary/default");
  assert.equal(figmaNameOf(config, "semantic", "color.bg.page"), "color/𝗨𝗦𝗔𝗚𝗘/bg/page");
  assert.equal(figmaNameOf(config, "component", "button.bg.primary.default"), "button/bg-primary-default");
  assert.equal(figmaNameOf(config, "primitive", "color.blue.500"), "color/blue/500");
  assert.equal(pathOfFigmaName("color/𝗨𝗦𝗔𝗚𝗘/background/page"), "color.background.page");
  assert.ok(isDividerName("𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ") && isDividerName("ㅤ ㅤ/ㅤ") && !isDividerName("color/blue/500"));
});

test("the reference file reads as tokens and its findings are reported", () => {
  const { flat, dividers, invalid } = fromFigmaSpecs(readVariablesTsv(fixture), config);
  assert.equal(Object.keys(flat).length, 461);
  assert.equal(dividers, 22);
  assert.deepEqual(invalid, []);
  assert.equal(flat["shadow.sm"].type, "shadow", "layer variables become one shadow token");
  assert.equal(flat["opacity.500"].value, 0.5, "percent in Figma, 0–1 in tokens");
  assert.equal(flat["color.secondary.brand-default"].value, "{color.lemon-tbd.500}", "aliases of deleted variables keep their name");
  const findings = checkModel(indexFlat(flat, config), config, null);
  assert.deepEqual(countBy(findings), {
    TOKEN_DESCRIPTION_MISSING: 193,
    TOKEN_TIER_CHAIN: 8,
    TOKEN_REF_MISSING: 18,
    TOKEN_RAW_VALUE: 3,
    TOKEN_KEY_SYNTAX: 2,
  });
});

test("tokens from the reference file write the same variables back", () => {
  const specs = readVariablesTsv(fixture);
  const { flat } = fromFigmaSpecs(specs, config);
  const tree = applyFlat({}, flat, config).tree;
  const out = toFigmaSpecs(toFlat(indexTree(tree, config)), config);
  const lines = (s) => writeVariablesTsv(s).split("\n").filter((l) => !l.startsWith("@") && !isDividerName(l.split("\t")[0]));
  assert.deepEqual(lines(out).sort(), lines(specs).sort(), "names, types, values, aliases, scopes and visibility");
  assert.deepEqual(out.collections.map((c) => [c.name, c.modes.map((m) => m.name)]), [["Primitive", ["Mode 1"]], ["Semantic", ["light", "dark"]], ["Components", ["Value"]]]);
  const headings = out.variables.filter((v) => !v.meta).map((v) => v.name);
  for (const name of ["𝗦𝗪𝗔𝗧𝗖𝗛𝗘𝗦/ㅤ", "color/𝗕𝗥𝗔𝗡𝗗/ㅤ", "color/𝗜𝗡𝗧𝗘𝗡𝗧/ㅤ", "𝗔𝗖𝗧𝗜𝗢𝗡/ㅤ", "𝗙𝗘𝗘𝗗𝗕𝗔𝗖𝗞/ㅤ"]) assert.ok(headings.includes(name), name);
});

test("the plugin checks a file it did not create, including aliases of deleted variables", async () => {
  const f = fakeFigma();
  const specs = readVariablesTsv(fixture);
  const collections = new Map();
  for (const c of specs.collections) {
    const collection = f.figma.variables.createVariableCollection(c.name);
    collection.renameMode(collection.modes[0].modeId, c.modes[0]);
    collections.set(c.name, collection);
  }
  const byKey = new Map();
  for (const s of specs.variables) {
    const v = f.figma.variables.createVariable(s.name, collections.get(s.collection), s.type);
    v.scopes = s.scopes;
    v.hiddenFromPublishing = s.hidden;
    byKey.set(s.key, v);
  }
  // Variables that were deleted in the file but are still referenced.
  const deleted = new Map();
  const target = (key) => {
    if (byKey.has(key)) return byKey.get(key);
    if (!deleted.has(key)) {
      const [collection, name] = key.split("|");
      const v = f.figma.variables.createVariable(name, collections.get(collection), "COLOR");
      v.remove();
      deleted.set(key, v);
    }
    return deleted.get(key);
  };
  const { parseColor } = await import("../src/core/color.mjs");
  for (const s of specs.variables) {
    const v = byKey.get(s.key);
    const mode = collections.get(s.collection).modes[0].modeId;
    const raw = s.values.light;
    if (raw?.alias) v.setValueForMode(mode, f.figma.variables.createVariableAlias(target(raw.alias)));
    else if (raw?.color)
      v.setValueForMode(mode, { color: f.figma.variables.createVariableAlias(target(raw.color.alias)), opacity: f.figma.variables.createVariableAlias(target(raw.opacity.alias)) });
    else v.setValueForMode(mode, s.type === "COLOR" ? parseColor(raw) : raw);
  }
  const checked = await f.send({ type: "check" });
  assert.equal(checked.count, 461);
  assert.equal(checked.created.length, 461, "every variable is new to the kit");
  const counts = countBy(checked.findings);
  assert.equal(counts.TOKEN_REF_MISSING, 18);
  assert.equal(counts.TOKEN_TIER_CHAIN, 8);
});
