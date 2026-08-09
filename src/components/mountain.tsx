/* Outdoors motifs pulled straight from the logo: the snow-cap notch and the
   twin-peak ridgeline. Reused across the homepage so the page speaks the same
   visual language as the mark. Both are inline SVG, no image weight. */

export function SnowCap({
  tone = "pine",
  size = 15,
  className = "",
}: {
  tone?: "pine" | "navy";
  size?: number;
  className?: string;
}) {
  const fill = tone === "pine" ? "var(--brand)" : "var(--ink-panel)";
  return (
    <svg
      viewBox="0 0 24 20"
      width={size}
      height={(size * 20) / 24}
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M12 1 L23 19 L1 19 Z" fill={fill} />
      <path d="M12 1 L8 9.5 L12 7.5 L16 9.5 Z" fill="#fff" />
    </svg>
  );
}

/* Interlocking ridgeline divider placed between two full-bleed sections.
   `above` is the color of the section above (it backs the transparent sky);
   `fill` is the section below, whose peaks rise into it. Twin-peak center
   echoes the logo. */
export function Ridgeline({
  above = "var(--canvas)",
  fill = "var(--surface-2)",
  className = "",
}: {
  above?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`leading-[0] ${className}`} style={{ background: above }}>
      <svg
        viewBox="0 0 1200 62"
        preserveAspectRatio="none"
        className="block h-[46px] w-full sm:h-[60px]"
      >
        <path
          d="M0 62 L0 40 L95 30 L175 46 L265 16 L345 42 L440 14 L530 40 L610 6 L700 38 L790 16 L890 44 L985 22 L1085 42 L1165 28 L1200 38 L1200 62 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
