type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
  /** Center the eyebrow (line + label) horizontally. */
  center?: boolean;
};

/**
 * Small uppercase gold label preceded by a short rule.
 * Shared section kicker used across the homepage.
 */
export default function Eyebrow({
  children,
  className = "",
  center,
}: EyebrowProps) {
  return (
    <div
      className={[
        "flex items-center gap-2.5",
        center ? "justify-center" : "",
        className,
      ].join(" ")}
    >
      <span className="bg-gold h-px w-7" />
      <span className="text-gold text-[9px] font-bold tracking-[0.28em] uppercase">
        {children}
      </span>
      {center && <span className="bg-gold h-px w-7" />}
    </div>
  );
}
