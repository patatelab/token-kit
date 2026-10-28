import { readFileSync } from "node:fs";
import { resolveConfig } from "../src/core/config.mjs";

export const starterTree = () => JSON.parse(readFileSync(new URL("../starter/tokens.json", import.meta.url), "utf8"));
export const starterConfig = () => resolveConfig(JSON.parse(readFileSync(new URL("../starter/token-kit.config.json", import.meta.url), "utf8")));
