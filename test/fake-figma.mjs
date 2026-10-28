// In-memory fake of the Figma Variables API used by the plugin tests.
import { readFileSync } from "node:fs";
import vm from "node:vm";

function pluginData() {
  const data = {};
  return { getPluginData: (k) => data[k] ?? "", setPluginData: (k, v) => void (data[k] = v) };
}

export function fakeFigma() {
  let id = 0;
  const collections = [];
  let variables = [];
  const deleted = []; // removed variables stay reachable by id, as in Figma
  const messages = [];
  const figma = {
    showUI() {},
    ui: { postMessage: (m) => messages.push(m), onmessage: null },
    root: { name: "Design file", ...pluginData() },
    variables: {
      createVariableCollection(name) {
        const c = {
          id: `c${++id}`,
          name,
          modes: [{ modeId: `m${++id}`, name: "Mode 1" }],
          renameMode(modeId, label) {
            this.modes.find((m) => m.modeId === modeId).name = label;
          },
          addMode(label) {
            const modeId = `m${++id}`;
            this.modes.push({ modeId, name: label });
            return modeId;
          },
        };
        collections.push(c);
        return c;
      },
      createVariable(name, collection, resolvedType) {
        const v = {
          id: `v${++id}`,
          name,
          variableCollectionId: collection.id,
          resolvedType,
          description: "",
          scopes: ["ALL_SCOPES"],
          hiddenFromPublishing: false,
          valuesByMode: {},
          ...pluginData(),
          setValueForMode(modeId, value) {
            this.valuesByMode[modeId] = value;
          },
          remove() {
            variables = variables.filter((x) => x !== this);
            deleted.push(this);
          },
        };
        variables.push(v);
        return v;
      },
      createVariableAlias: (v) => ({ type: "VARIABLE_ALIAS", id: v.id }),
      getLocalVariableCollectionsAsync: async () => [...collections],
      getLocalVariablesAsync: async () => [...variables],
      getVariableByIdAsync: async (id) => variables.find((v) => v.id === id) ?? deleted.find((v) => v.id === id) ?? null,
    },
  };
  const code = readFileSync(new URL("../figma-plugin/dist/code.js", import.meta.url), "utf8");
  vm.runInNewContext(code, { figma, __html__: "", console });
  const send = async (msg) => {
    messages.length = 0;
    await figma.ui.onmessage(msg);
    return JSON.parse(JSON.stringify(messages.at(-1))); // plain objects from the vm realm
  };
  return { figma, send, collections, all: () => variables };
}

