import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFlat, filterTreeByTier, indexTree, toFlat } from "../src/core/tokens.mjs";
import { checkModel, indexFlat } from "../src/core/rules.mjs";
import { gateFindings, nextBaselines, emptyBaseline } from "../src/core/baseline.mjs";
import { checksumOf, createBundle, diffFlat, validateBundle } from "../src/core/bundle.mjs";
import { contrastRatio, parseColor } from "../src/core/color.mjs";
import { sha256Hex } from "../src/core/sha256.mjs";
import { starterConfig, starterTree } from "./helpers.mjs";
import { resolveConfig } from "../src/core/config.mjs";

const rules = (findings) => findings.map((f) => `${f.rule} ${f.subject}`);

test("starter tokens are conform", () => {
  const config = starterConfig();
  assert.deepEqual(checkModel(indexTree(starterTree(), config), config, starterTree()), []);
});

test("tiers come from foundations, prefixes and families", () => {
  const index = indexTree(starterTree(), starterConfig());
  const tier = (p) => index.tokens.get(`light:${p}`).tier;
  assert.equal(tier("palette.brand.500"), "primitive");
  assert.equal(tier("spacing.4"), "scale");
  assert.equal(tier("space.gutter"), "basic");
  assert.equal(tier("button.radius"), "component");
  assert.equal(index.tokens.get("dark:color.text.default").storage[0], "dark-mode");
});

test("model rules catch broken chains, literals, names, cycles, themes and contrast", () => {
  const config = starterConfig();
  const tree = starterTree();
  tree.button.radius.$value = "{corner.2}"; // component -> primitive
  tree.card.gap.$value = "12px"; // raw value
  tree.card.padding.$value = "{space.missing}";
  tree.space["gutter-16px"] = { $value: "{spacing.4}", $description: "duplicate" };
  tree.color.text.default.$value = "{color.text.muted}";
  tree.color.text.muted.$value = "{color.text.default}";
  tree["dark-mode"].color.brand = { "on-primary": { $value: "{palette.brand.400}" } };
  tree["dark-mode"].button = { radius: { $type: "dimension", $value: "{radius.surface}" } };
  const found = rules(checkModel(indexTree(tree, config), config, tree));
  for (const expected of [
    "TOKEN_TIER_CHAIN button.radius",
    "TOKEN_RAW_VALUE card.gap",
    "TOKEN_REF_MISSING card.padding",
    "TOKEN_NAME_LITERAL space.gutter-16px",
    "TOKEN_SCALE_ALIAS_DUPLICATE space.gutter-16px",
    "TOKEN_REF_CYCLE color.text.default",
    "TOKEN_THEME_OVERRIDE button.radius (dark)",
    "TOKEN_CONTRAST color.brand.on-primary on color.brand.primary",
  ])
    assert.ok(found.includes(expected), `${expected} missing in\n${found.join("\n")}`);
});

test("the tier model is configurable: three tiers without a foundations group", () => {
  const config = resolveConfig({
    themes: {},
    requireDescriptions: [],
    tiers: [
      { name: "core", match: { prefixes: ["core"] }, references: [], literals: true, internal: true },
      { name: "semantic", match: { prefixes: ["sys"] }, references: ["core"] },
      { name: "component", match: {}, references: ["semantic"], families: true },
    ],
  });
  const tree = {
    core: { $type: "color", blue: { $value: "#2563EB" } },
    sys: { $type: "color", accent: { $value: "{core.blue}" } },
    button: { $type: "color", bg: { $value: "{sys.accent}" }, border: { $value: "{core.blue}" }, text: { $value: "#fff" } },
  };
  const index = indexTree(tree, config);
  assert.deepEqual([...index.tokens.values()].map((e) => `${e.path}:${e.tier}`), ["core.blue:core", "sys.accent:semantic", "button.bg:component", "button.border:component", "button.text:component"]);
  assert.deepEqual(rules(checkModel(index, config)), ["TOKEN_TIER_CHAIN button.border", "TOKEN_RAW_VALUE button.text"]);
});

test("ratchet: known reviews pass, new ones fail, baselines only shrink", () => {
  const a = { rule: "R", severity: "review", subject: "x", message: "m" };
  const b = { rule: "R", severity: "review", subject: "y", message: "m" };
  const e = { rule: "E", severity: "error", subject: "z", message: "m" };
  const accepted = nextBaselines([a, e], { ratchet: emptyBaseline(), knownErrors: emptyBaseline() }, { acceptNew: true });
  assert.deepEqual(gateFindings([a, e], accepted), []);
  assert.deepEqual(gateFindings([a, a, b, e], accepted), [a, b]);
  const shrunk = nextBaselines([b], accepted);
  assert.equal(shrunk.ratchet.total, 0);
  assert.equal(shrunk.knownErrors.total, 0);
});

test("bundle checksum, validation and diff", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("äö€😀").length, 64);
  const config = starterConfig();
  const bundle = createBundle({ kind: "tree", tokens: starterTree(), config: {} });
  assert.deepEqual(validateBundle(bundle), []);
  assert.equal(checksumOf({ b: 1, a: 2 }), checksumOf({ a: 2, b: 1 }));
  bundle.tokens.color.text.default.$value = "#FF0000";
  assert.match(validateBundle(bundle).join(), /checksum mismatch/);
  const flat = toFlat(indexTree(starterTree(), config));
  const changed = structuredClone(flat);
  changed["space.gutter"].value = "{spacing.5}";
  delete changed["card.gap"];
  changed["card.shadow-color"] = { type: "color", value: "{color.border.default}", tier: "component" };
  assert.deepEqual(diffFlat(flat, changed), { added: ["card.shadow-color"], changed: ["space.gutter"], removed: ["card.gap"] });
});

test("applyFlat writes changes in place, inserts new tokens and removes with replace", () => {
  const config = starterConfig();
  const tree = starterTree();
  const flat = toFlat(indexTree(tree, config));
  flat["palette.brand.500"].value = "#1E40AF";
  flat["color.brand.primary"].themes = { dark: "{palette.brand.400}" };
  flat["palette.brand.700"] = { type: "color", value: "#1E3A8A", tier: "primitive" };
  delete flat["card.gap"];
  const merged = applyFlat(tree, flat, config);
  assert.equal(merged.tree.foundations.palette.brand["500"].$value, "#1E40AF");
  assert.equal(merged.tree.foundations.palette.brand["700"].$value, "#1E3A8A");
  assert.equal(merged.tree["dark-mode"].color.brand.primary.$value, "{palette.brand.400}");
  assert.ok(merged.tree.card.gap, "merge keeps tokens missing from the bundle");
  assert.deepEqual(merged.changes.added.sort(), ["color.brand.primary (dark)", "palette.brand.700"]);
  const replaced = applyFlat(tree, flat, config, { strategy: "replace" });
  assert.equal(replaced.tree.card.gap, undefined);
  assert.deepEqual(replaced.changes.removed, ["card.gap"]);
  // A full round trip through the flat form is lossless.
  assert.deepEqual(applyFlat(tree, toFlat(indexTree(tree, config)), config).tree, tree);
});

test("flat index gives the same findings as the tree", () => {
  const config = starterConfig();
  const tree = starterTree();
  tree.card.gap.$value = "12px";
  const fromTree = checkModel(indexTree(tree, config), config);
  const fromFlat = checkModel(indexFlat(toFlat(indexTree(tree, config)), config), config);
  assert.deepEqual(rules(fromFlat), rules(fromTree));
});

test("tier filter keeps foundations and basic roles only", () => {
  const config = starterConfig();
  const filtered = filterTreeByTier(starterTree(), config, ["primitive", "scale", "basic"]);
  assert.equal(filtered.button, undefined);
  assert.ok(filtered.foundations.palette && filtered.color && filtered["dark-mode"].color);
});

test("colour parsing and WCAG contrast", () => {
  assert.deepEqual(parseColor("#fff"), { r: 1, g: 1, b: 1, a: 1 });
  assert.equal(parseColor("color-mix(in srgb, red, blue)"), null);
  assert.equal(contrastRatio(parseColor("#000"), parseColor("#fff")).toFixed(0), "21");
  assert.ok(contrastRatio(parseColor("rgba(0,0,0,0.5)"), parseColor("#fff")) < 4.5);
});
