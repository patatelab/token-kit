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

test("tiers come from the primitive and semantic roots; the rest are component families", () => {
  const index = indexTree(starterTree(), starterConfig());
  const tier = (p, theme = "light") => index.tokens.get(`${theme}:${p}`).tier;
  assert.equal(tier("color.blue.500"), "primitive");
  assert.equal(tier("radius.500"), "primitive");
  assert.equal(tier("color.primary.default"), "semantic");
  assert.equal(tier("color.primary.default", "dark"), "semantic");
  assert.equal(tier("button.bg.primary.default"), "component");
  assert.equal(index.tokens.get("light:button.bg.primary.default").family, "button");
  assert.deepEqual(index.tokens.get("dark:color.text.default").storage.slice(0, 2), ["dark-mode", "semantic"]);
});

test("model rules catch broken chains, literals, names, cycles, themes and contrast", () => {
  const config = starterConfig();
  const tree = starterTree();
  tree.button.radius.md.$value = "{radius.500}"; // component -> primitive
  tree.card.gap.$value = "12px"; // raw value
  tree.card.padding.md.$value = "{spacing.missing}";
  tree.semantic.spacing["gutter-16px"] = { $value: "{space.200}", $description: "duplicate" };
  tree.semantic.spacing["200"] = { $value: "{space.200}", $description: "step name" };
  tree.primitive.radius["raw-16px"] = { $value: "16px" }; // unit in a Primitive name
  tree.primitive.size["number-60"] = { $value: "60ch" }; // value prefix
  tree.primitive.motion.duration["raw-250ms"] = { $value: "250ms" }; // unit ms
  tree.semantic.gap = { $type: "dimension", md: { $value: "{space.100}", $description: "unknown category" } };
  tree.semantic.color.bg.default.$value = "{color.blue.500}"; // ok: semantic -> primitive
  tree.semantic.color.text.default.$value = "{color.primary.default}"; // semantic -> semantic
  tree.primitive.color.grey["050"].$value = "{color.white}"; // primitive -> primitive
  tree.primitive.color.lemon["600"].$value = "{color.lemon.700}";
  tree.primitive.color.lemon["700"].$value = "{color.lemon.600}";
  tree["dark-mode"].semantic.color.primary["on-primary"] = { $value: "{color.lemon.400}" };
  tree["dark-mode"].button = { radius: { md: { $type: "dimension", $value: "{radius.md}" } } };
  const found = rules(checkModel(indexTree(tree, config), config, tree));
  for (const expected of [
    "TOKEN_TIER_CHAIN button.radius.md",
    "TOKEN_TIER_CHAIN color.text.default",
    "TOKEN_TIER_CHAIN color.grey.050",
    "TOKEN_RAW_VALUE card.gap",
    "TOKEN_REF_MISSING card.padding.md",
    "TOKEN_NAME_LITERAL spacing.gutter-16px",
    "TOKEN_NAME_LITERAL spacing.200",
    "TOKEN_NAME_LITERAL radius.raw-16px",
    "TOKEN_NAME_LITERAL size.number-60",
    "TOKEN_NAME_LITERAL motion.duration.raw-250ms",
    "TOKEN_NAME_STRUCTURE gap.md",
    "TOKEN_ROLE_DUPLICATE spacing.gutter-16px",
    "TOKEN_REF_CYCLE color.lemon.600",
    "TOKEN_THEME_OVERRIDE button.radius.md (dark)",
    "TOKEN_CONTRAST color.primary.on-primary on color.primary.default",
  ])
    assert.ok(found.includes(expected), `${expected} missing in\n${found.join("\n")}`);
});

test("the tier model is configurable: three tiers matched by prefixes", () => {
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
  bundle.tokens.semantic.color.text.default.$value = "#FF0000";
  assert.match(validateBundle(bundle).join(), /checksum mismatch/);
  const flat = toFlat(indexTree(starterTree(), config));
  const changed = structuredClone(flat);
  changed["spacing.md"].value = "{space.300}";
  delete changed["card.gap"];
  changed["card.divider.default"] = { type: "color", value: "{color.border.default}", tier: "component" };
  assert.deepEqual(diffFlat(flat, changed), { added: ["card.divider.default"], changed: ["spacing.md"], removed: ["card.gap"] });
});

test("applyFlat writes changes in place, inserts new tokens and removes with replace", () => {
  const config = starterConfig();
  const tree = starterTree();
  const flat = toFlat(indexTree(tree, config));
  flat["color.blue.500"].value = "#1E40AF";
  flat["color.brand.primary"].themes = { dark: "{color.lemon.400}" };
  flat["color.blue.800"] = { type: "color", value: "#1E3A8A", tier: "primitive" };
  flat["color.purple.500"] = { type: "color", value: "#7C3AED", tier: "primitive" };
  flat["color.accent.default"] = { type: "color", value: "{color.purple.500}", tier: "semantic", description: "Accent." };
  delete flat["card.gap"];
  const merged = applyFlat(tree, flat, config);
  assert.equal(merged.tree.primitive.color.blue["500"].$value, "#1E40AF");
  assert.equal(merged.tree.primitive.color.blue["800"].$value, "#1E3A8A");
  assert.equal(merged.tree.primitive.color.purple["500"].$value, "#7C3AED", "new groups land in their tier root");
  assert.equal(merged.tree.semantic.color.accent.default.$value, "{color.purple.500}");
  assert.equal(merged.tree["dark-mode"].semantic.color.brand.primary.$value, "{color.lemon.400}");
  assert.ok(merged.tree.card.gap, "merge keeps tokens missing from the bundle");
  assert.deepEqual(merged.changes.added.sort(), ["color.accent.default", "color.blue.800", "color.brand.primary (dark)", "color.purple.500"]);
  assert.deepEqual(checkModel(indexTree(merged.tree, config), config, merged.tree), []);
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

test("tier filter keeps primitive and semantic tokens only", () => {
  const config = starterConfig();
  const filtered = filterTreeByTier(starterTree(), config, ["primitive", "semantic"]);
  assert.equal(filtered.button, undefined);
  assert.ok(filtered.primitive.color && filtered.semantic.color && filtered["dark-mode"].semantic.color);
});

test("colour parsing and WCAG contrast", () => {
  assert.deepEqual(parseColor("#fff"), { r: 1, g: 1, b: 1, a: 1 });
  assert.equal(parseColor("color-mix(in srgb, red, blue)"), null);
  assert.equal(contrastRatio(parseColor("#000"), parseColor("#fff")).toFixed(0), "21");
  assert.ok(contrastRatio(parseColor("rgba(0,0,0,0.5)"), parseColor("#fff")) < 4.5);
});
