// Next aliases this marker during server compilation. Node unit tests do not
// have that compiler; ignore only the marker, never the application module.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node's CJS preload runs before tsx.
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === "server-only") return {};
  return originalLoad.call(this, id, ...args);
};
