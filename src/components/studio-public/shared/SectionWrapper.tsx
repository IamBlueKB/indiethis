import type { ReactNode, CSSProperties } from "react";

export function SectionWrapper({
  children,
  id,
  className = "",
  style,
  maxWidth = "max-w-6xl",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
  maxWidth?: string;
}) {
  return (
    <section id={id} className={`py-24 px-6 ${className}`} style={style}>
      <div className={`${maxWidth} mx-auto`}>{children}</div>
    </section>
  );
}
