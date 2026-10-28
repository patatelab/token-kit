// token-kit command line. Node >= 20, no dependencies.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { portableConfig, resolveConfig } from "../core/config.mjs";
import { applyFlat, filterTreeByTier, indexTree, toFlat } from "../core/tokens.mjs";
import { checkModel } from "../core/rules.mjs";
import { baselineIsStale, emptyBaseline, gateFindings, nextBaselines } from "../core/baseline.mjs";
import { createBundle, diffFlat, validateBundle } from "../core/bundle.mjs";
import { auditSource, tokenVarTiers } from "./source-audit.mjs";

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BUILTIN_FORMATS = ["css-variables", "tailwind-v4", "typescript"];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) args._.push(a);
    else if (a.includes("=")) args[a.slice(2, a.indexOf("="))] = a.slice(a.indexOf("=") + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") && VALUE_FLAGS.has(a.slice(2))) args[a.slice(2)] = argv[++i];
    else args[a.slice(2)] = true;
  }
  return args;
}
const VALUE_FLAGS = new Set(["config", "out", "tiers", "strategy", "only", "report", "cwd"]);

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function load(args) {
  const cwd = resolve(args.cwd ?? process.cwd());
  const configPath = resolve(cwd, args.config ?? "token-kit.config.json");
  const config = resolveConfig(readJson(configPath, {}));
  const tokensPath = resolve(cwd, config.tokens);
  const tree = readJson(tokensPath, null);
  return { cwd, config, configPath, tokensPath, tree };
}

function requireTree(ctx) {
  if (!ctx.tree) throw new Error(`No token file at ${ctx.tokensPath}. Run "token-kit init" or set "tokens" in token-kit.config.json.`);
  return ctx.tree;
}

function loadBaselines(ctx) {
  return {
    ratchet: readJson(resolve(ctx.cwd, ctx.config.baselines.ratchet), emptyBaseline()),
    knownErrors: readJson(resolve(ctx.cwd, ctx.config.baselines.knownErrors), emptyBaseline()),
  };
}

function allFindings(ctx) {
  const index = indexTree(requireTree(ctx), ctx.config);
  const model = checkModel(index, ctx.config, ctx.tree);
  const source = auditSource(ctx.cwd, ctx.config, tokenVarTiers(index, ctx.config));
  return { index, findings: [...model, ...source] };
}

function formatFinding(f) {
  const where = f.line ? `${f.subject}:${f.line}` : f.subject;
  return `${f.severity === "error" ? "✖" : "•"} ${f.rule}  ${where}  ${f.message}\n    → ${f.suggestion}`;
}

function summary(findings) {
  const errors = findings.filter((f) => f.severity === "error").length;
  return `${errors} error(s), ${findings.length - errors} review(s)`;
}

async function loadFormat(name, ctx) {
  const url = BUILTIN_FORMATS.includes(name)
    ? new URL(`./formats/${name}.mjs`, import.meta.url)
    : pathToFileURL(isAbsolute(name) ? name : resolve(dirname(ctx.configPath), name));
  return (await import(url.href)).default;
}

const commands = {
  async init(args) {
    const cwd = resolve(args.cwd ?? process.cwd());
    const copies = [
      ["starter/token-kit.config.json", "token-kit.config.json"],
      ["starter/tokens.json", "tokens/tokens.json"],
      ["copilot/copilot-instructions.md", ".github/copilot-instructions.md"],
      ["copilot/instructions/tokens.instructions.md", ".github/instructions/tokens.instructions.md"],
      ["copilot/prompts", ".github/prompts"],
      ["templates/token-check.yml", ".github/workflows/token-check.yml"],
      ["docs/token-contract.md", "docs/token-contract.md"],
    ];
    for (const [from, to] of copies) {
      const target = join(cwd, to);
      if (existsSync(target) && !args.force) {
        console.log(`skip   ${to} (exists; --force overwrites)`);
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(KIT_ROOT, from), target, { recursive: true });
      console.log(`create ${to}`);
    }
    writeJson(join(cwd, "tokens/baselines/open-review-ratchet.json"), emptyBaseline());
    writeJson(join(cwd, "tokens/baselines/known-errors.json"), emptyBaseline());
    console.log('\nNext: "npx token-kit build" and "npx token-kit check".');
  },

  async build(args) {
    const ctx = load(args);
    const index = indexTree(requireTree(ctx), ctx.config);
    const outDir = resolve(ctx.cwd, ctx.config.outDir);
    let stale = 0;
    for (const name of ctx.config.formats) {
      const format = await loadFormat(name, ctx);
      for (const file of format.files({ tree: ctx.tree, index, config: ctx.config })) {
        const target = join(outDir, file.path);
        if (args.check) {
          if (!existsSync(target) || readFileSync(target, "utf8") !== file.content) {
            console.error(`TOKEN_GENERATED_STALE: ${target}`);
            stale++;
          }
          continue;
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
        console.log(`✓ ${format.name} → ${target}`);
      }
    }
    if (stale) process.exitCode = 1;
  },

  async check(args) {
    const ctx = load(args);
    const { findings } = allFindings(ctx);
    const failing = args.strict ? findings : gateFindings(findings, loadBaselines(ctx));
    const shown = args.list ? findings : failing;
    if (args.json) console.log(JSON.stringify({ findings: shown, failing: failing.length }, null, 2));
    else {
      for (const f of shown) console.log(formatFinding(f));
      console.log(`\n${summary(findings)} in total; ${failing.length} not covered by the baselines${args.strict ? " (strict)" : ""}.`);
    }
    if (failing.length) process.exitCode = 1;
  },

  async report(args) {
    const ctx = load(args);
    const { findings } = allFindings(ctx);
    const current = loadBaselines(ctx);
    const next = nextBaselines(findings, current, { acceptNew: Boolean(args["accept-new"]) });
    if (args.check) {
      const stale = ["ratchet", "knownErrors"].filter((k) => baselineIsStale(current[k], next[k]));
      for (const k of stale) console.error(`TOKEN_BASELINE_STALE: ${ctx.config.baselines[k]} lists resolved findings; run "token-kit report".`);
      if (stale.length) process.exitCode = 1;
      return;
    }
    writeJson(resolve(ctx.cwd, ctx.config.baselines.ratchet), next.ratchet);
    writeJson(resolve(ctx.cwd, ctx.config.baselines.knownErrors), next.knownErrors);
    console.log(`Baselines: ${next.knownErrors.total} known error(s), ${next.ratchet.total} open review(s). ${summary(findings)} found.`);
  },

  async export(args) {
    const ctx = load(args);
    let tree = requireTree(ctx);
    if (args.tiers) tree = filterTreeByTier(tree, ctx.config, String(args.tiers).split(","));
    let commit;
    try {
      commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ctx.cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      commit = undefined;
    }
    const flat = Boolean(args.flat);
    const bundle = createBundle({
      kind: flat ? "flat" : "tree",
      tokens: flat ? toFlat(indexTree(tree, ctx.config)) : tree,
      config: portableConfig(ctx.config),
      source: { tool: "token-kit-cli", project: ctx.config.project ?? undefined, commit },
      baselines: loadBaselines(ctx),
      contracts: flat ? tree.$extensions : undefined,
    });
    const out = resolve(ctx.cwd, args.out ?? "tokens.bundle.json");
    writeJson(out, bundle);
    const count = Object.keys(toFlat(indexTree(tree, ctx.config))).length;
    console.log(`✓ ${count} tokens exported → ${out} (${bundle.checksum})`);
  },

  async import(args) {
    const ctx = load(args);
    const file = args._[1];
    if (!file) throw new Error("Usage: token-kit import <bundle.json> [--apply] [--strategy merge|replace] [--only a,b] [--accept-new-tokens]");
    const bundle = JSON.parse(readFileSync(resolve(ctx.cwd, file), "utf8"));
    const errors = validateBundle(bundle);
    if (errors.length) {
      for (const e of errors) console.error(`✖ TOKEN_BUNDLE_INVALID  ${e}`);
      process.exitCode = 1;
      return;
    }
    const strategy = args.strategy ?? (bundle.kind === "tree" && !ctx.tree ? "replace" : "merge");
    const only = args.only ? String(args.only).split(",") : null;
    const base = ctx.tree ?? {};
    let next;
    if (bundle.kind === "tree" && !ctx.tree) {
      next = JSON.parse(JSON.stringify(bundle.tokens));
    } else {
      const incoming = bundle.kind === "tree" ? indexTree(bundle.tokens, ctx.config) : null;
      const incomingFlat = incoming ? toFlat(incoming) : bundle.tokens;
      const storage = incoming ? new Map([...incoming.tokens].map(([k, e]) => [k, e.storage])) : null;
      next = applyFlat(base, incomingFlat, ctx.config, { strategy, only, storage }).tree;
    }

    const before = toFlat(indexTree(base, ctx.config));
    const after = toFlat(indexTree(next, ctx.config));
    const diff = diffFlat(before, after);
    const nextCtx = { ...ctx, tree: next };
    const { findings } = allFindings(nextCtx);
    const failing = gateFindings(findings, loadBaselines(ctx));
    const newTokens = diff.added;

    const lines = [
      `# Token import: ${file}`,
      "",
      `Source: ${bundle.source?.tool ?? "unknown"}${bundle.source?.commit ? ` @ ${bundle.source.commit}` : ""}, exported ${bundle.exportedAt}. Strategy: ${strategy}${only ? `, only ${only.join(", ")}` : ""}.`,
      "",
      `| | Count |`,
      `| --- | --- |`,
      `| Added | ${diff.added.length} |`,
      `| Changed | ${diff.changed.length} |`,
      `| Removed | ${diff.removed.length} |`,
      `| Failing findings | ${failing.length} |`,
      "",
      ...(["added", "changed", "removed"].flatMap((k) => (diff[k].length ? [`## ${k[0].toUpperCase() + k.slice(1)}`, "", ...diff[k].map((p) => `- \`${p}\``), ""] : []))),
      ...(failing.length ? ["## Failing findings", "", ...failing.map((f) => `- **${f.rule}** \`${f.subject}${f.line ? ":" + f.line : ""}\` ${f.message}`), ""] : []),
      ...(newTokens.length ? ["## Approval needed", "", `${newTokens.length} new token(s) need the owner's approval (tier, name, owner, Semantic and Primitive backing, Light/Dark, consumers) before --apply with --accept-new-tokens.`, ""] : []),
    ];
    const report = lines.join("\n");
    if (args.report) writeFileSync(resolve(ctx.cwd, args.report), report + "\n");
    console.log(report);

    if (failing.length) {
      console.error("\n✖ Import not conform; nothing written.");
      process.exitCode = 1;
      return;
    }
    if (!args.apply) {
      console.log("\nDry run: nothing written. Add --apply to write tokens.json.");
      return;
    }
    if (newTokens.length && !args["accept-new-tokens"]) {
      console.error("\n✖ New tokens need approval; re-run with --accept-new-tokens once approved. Nothing written.");
      process.exitCode = 2;
      return;
    }
    writeJson(ctx.tokensPath, next);
    if (bundle.kind === "tree" && bundle.baselines && !ctx.tree) {
      writeJson(resolve(ctx.cwd, ctx.config.baselines.ratchet), bundle.baselines.ratchet);
      writeJson(resolve(ctx.cwd, ctx.config.baselines.knownErrors), bundle.baselines.knownErrors);
    }
    console.log(`\n✓ Written ${ctx.tokensPath}. Run "token-kit build" next.`);
  },
};

export async function main(argv) {
  const args = parseArgs(argv);
  const name = args._[0];
  if (!commands[name]) {
    console.log(`token-kit <command>

  init                     copy starter tokens, config, Copilot files and CI workflow
  build [--check]          generate outputs (formats in token-kit.config.json)
  check [--strict|--list|--json]   model + source audit against the baselines
  report [--accept-new|--check]    shrink (or deliberately raise) the baselines
  export [--out f] [--tiers a,b] [--flat]   (tier names from the config)
  import <bundle> [--apply] [--strategy merge|replace] [--only a,b] [--accept-new-tokens] [--report f.md]

  --config <path>  default token-kit.config.json   --cwd <dir>  default .`);
    if (name && name !== "help") process.exitCode = 1;
    return;
  }
  await commands[name](args);
}
