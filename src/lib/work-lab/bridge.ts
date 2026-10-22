import {
  resolveWorkLabConfig, labActions, type WorkLabConfig,
} from "../../../supabase/functions/_shared/work-lab-config.ts";
export type LabCommand =
  | { type: "config"; value: WorkLabConfig }
  | { type: "parameter"; key: string; value: number }
  | { type: "effect"; key: string; value: boolean }
  | { type: "option"; key: string; value: string }
  | { type: "palette"; key: string; value: string }
  | { type: "action"; value: keyof typeof labActions }
  | { type: "view"; value: "browse" | "detail" | "inspect" }
  | { type: "reset-config" };
const pending = new WeakMap<HTMLElement, LabCommand[]>();
export function sendLabCommand(root: HTMLElement, command: LabCommand) {
  if (root.dataset.labController === "ready")
    root.dispatchEvent(new CustomEvent("outdesign:lab-command", { detail: command }));
  else pending.set(root, [...(pending.get(root) || []).slice(-31), command]);
}
export function takeLabCommands(root: HTMLElement) {
  const commands = pending.get(root) || [];
  pending.delete(root);
  return commands;
}
export function patchLabConfig(config: WorkLabConfig, command: LabCommand) {
  if (command.type === "config") return resolveWorkLabConfig(command.value);
  const group = command.type === "parameter" ? "parameters"
    : command.type === "effect" ? "effects"
    : command.type === "option" ? "options"
    : command.type === "palette" ? "palette" : null;
  if (!group || !("key" in command) || !Object.hasOwn(config[group], command.key)) return config;
  return resolveWorkLabConfig({ ...config, [group]: { ...config[group], [command.key]: command.value } });
}
