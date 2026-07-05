/**
 * Decorative concentric Islamic geometric motif (rings + octagon + 8-point star).
 * Purely ornamental; rendered faint behind dark maroon sections.
 */
export default function GeoMotif({ className = "" }: { className?: string }) {
  const octagon =
    "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
  const star =
    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute opacity-[0.07]",
        className,
      ].join(" ")}
    >
      <div className="relative h-[600px] w-[600px]">
        {[560, 420, 280].map((s) => (
          <span
            key={s}
            className="border-gold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ width: s, height: s }}
          />
        ))}
        <span
          className="border-gold absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 border"
          style={{
            transform: "translate(-50%, -50%) rotate(22.5deg)",
            clipPath: octagon,
          }}
        />
        <span
          className="border-gold absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 border"
          style={{ clipPath: star }}
        />
      </div>
    </div>
  );
}
