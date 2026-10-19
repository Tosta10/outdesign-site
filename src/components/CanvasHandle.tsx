export function CanvasHandle({
  id,
  label,
  editing,
}: {
  id: string;
  label: string;
  editing: boolean;
}) {
  if (!editing) return null;
  return (
    <button
      type="button"
      className="canvas-sort-handle"
      data-drag-handle={id}
      aria-label={`拖曳排序：${label}`}
      title="長按拖曳；方向鍵亦可排序"
    >
      <span aria-hidden="true">⠿</span>
      <span>{label}</span>
    </button>
  );
}
