export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    select: <path d="m5 3 14 9-7 1-3 7z" />,
    move: <path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />,
    hand: <path d="M7 12V6a2 2 0 0 1 3 0V4a2 2 0 0 1 3 0v2a2 2 0 0 1 3 0v2a2 2 0 0 1 3 0v7c0 4-3 7-7 7-3 0-5-2-7-5l-2-4c-1-2 1-3 2-2l2 2" />,
    "align-left": <path d="M4 3v18M8 7h12v4H8zM8 15h8v4H8z" />,
    "align-center": <path d="M12 2v20M4 6h16v4H4zM7 14h10v4H7z" />,
    "align-right": <path d="M20 3v18M4 7h12v4H4zM8 15h8v4H8z" />,
    frame: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>,
    text: <path d="M5 6V3h14v3M12 3v18M8 21h8" />,
    save: <><path d="M4 3h13l4 4v14H3V3zM7 3v6h10V3" /><path d="M7 21v-8h10v8" /></>,
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    diagonal: (
      <>
        <path d="M6 18 18 6M6 6h12v12" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 8h16M4 16h16" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    play: <path d="m9 5 11 7-11 7z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    volume: (
      <>
        <path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    undo: (
      <>
        <path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" />
      </>
    ),
    redo: (
      <>
        <path d="M20 10H10a6 6 0 0 0 0 12M20 10l-5-5M20 10l-5 5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    up: <path d="m6 14 6-6 6 6" />,
    down: <path d="m6 10 6 6 6-6" />,
    file: (
      <>
        <path d="M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H3v16h6M10 12h11m-5-5 5 5-5 5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
