/**
 * eve ships a managed desktop (Xvfb + xfwm4 + Firefox + xterm, driven by a
 * computer-use driver) inside its `code` extension. Mounting the whole
 * extension would also add GitHub tooling and a coding persona, so Bez Bot
 * imports just the desktop pieces from their modules.
 */
export {
  installComputerUse,
  startComputerUse,
} from "../../node_modules/eve/dist/src/extensions/code/extension/lib/computer-use-sandbox.js";
export { computerUsePaths } from "../../node_modules/eve/dist/src/extensions/code/extension/lib/computer-use.js";
export { default as computerUseTool } from "../../node_modules/eve/dist/src/extensions/code/extension/tools/computer_use.js";
