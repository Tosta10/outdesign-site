import {
  assemblySchema,
  type Assembly,
  type CanvasNode,
} from "../../supabase/functions/_shared/schema.ts";
import { descendants } from "./workspace.ts";

/** Save a self-contained tree; external parent links never enter the preset. */
export function saveAssembly(
  nodes: CanvasNode[],
  root: string,
  name: string,
): Assembly {
  const ids = new Set([root, ...descendants(nodes, root)]);
  const source = structuredClone(nodes.filter((node) => ids.has(node.id)));
  const frame = source.find((node) => node.id === root);
  if (frame) frame.parent = null;
  return assemblySchema.parse({ id: crypto.randomUUID(), name, nodes: source });
}

/** Every insertion owns its IDs. Replacing a frame preserves its root selection. */
export function instantiateAssembly(
  assembly: Assembly,
  page: CanvasNode["page"],
  parent: string | null,
  rootId?: string,
): CanvasNode[] {
  const root = assembly.nodes.find((node) => !node.parent)!;
  const mapping = new Map(
    assembly.nodes.map((node) => [
      node.id,
      node.id === root.id && rootId ? rootId : crypto.randomUUID(),
    ]),
  );
  const result = structuredClone(assembly.nodes).map((node) => ({
    ...node,
    page,
    id: mapping.get(node.id)!,
    parent: node.parent ? mapping.get(node.parent)! : parent,
    name: node.id === root.id ? assembly.name : node.name,
  }));
  // Root first makes selection independent of the original serialization order.
  return result.sort(
    (a, b) =>
      Number(b.id === mapping.get(root.id)) -
      Number(a.id === mapping.get(root.id)),
  );
}
