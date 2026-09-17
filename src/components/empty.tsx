export function Character({
  mood = "idle",
}: {
  mood?: "idle" | "empty" | "success" | "warn" | "welcome";
}) {
  const colors = {
    idle: ["#A18CD1", "#FBC2EB"],
    empty: ["#A18CD1", "#FBC2EB"],
    success: ["#56CCF2", "#2AF598"],
    warn: ["#FF9A9E", "#FAD0C4"],
    welcome: ["#667EEA", "#F093FB"],
  }[mood];

  return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none" aria-hidden>
      <ellipse cx="90" cy="122" rx="48" ry="8" fill="rgba(0,0,0,0.06)" />
      <rect x="62" y="54" width="56" height="58" rx="22" fill={colors[0]} opacity="0.9" />
      <circle cx="90" cy="42" r="22" fill={colors[1]} />
      <circle cx="83" cy="40" r="3" fill="#1A1A1E" />
      <circle cx="97" cy="40" r="3" fill="#1A1A1E" />
      <path d="M84 48c4 4 8 4 12 0" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" />
      <rect x="48" y="72" width="16" height="10" rx="5" fill={colors[1]} />
      <rect x="116" y="72" width="16" height="10" rx="5" fill={colors[1]} />
      {mood === "warn" && <circle cx="132" cy="28" r="10" fill="#FFB347" />}
      {mood === "success" && (
        <path d="M124 30l6 6 12-12" stroke="#34C759" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function EmptyState({
  title,
  body,
  action,
  mood = "empty",
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  mood?: "idle" | "empty" | "success" | "warn" | "welcome";
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <Character mood={mood} />
      <h3 className="mt-4 text-[22px] font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-sn-secondary">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
