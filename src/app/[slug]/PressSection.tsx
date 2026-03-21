// Server component

type PressItem = {
  id:     string;
  source: string;
  title:  string;
  url:    string;
};

export default function PressSection({ items }: { items: PressItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <p
        className="text-[10px] font-bold uppercase mb-[5px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        PRESS
      </p>
      <h2 className="text-[18px] font-semibold text-white leading-tight mb-3">
        In the Media
      </h2>

      <div>
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-[10px] py-2"
            style={{
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
            }}
          >
            <span
              className="shrink-0 font-semibold uppercase"
              style={{ fontSize: 10, color: "#D4A843", minWidth: 60 }}
            >
              {item.source}
            </span>
            <span className="flex-1 text-white truncate" style={{ fontSize: 11 }}>
              {item.title}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 no-underline hover:brightness-125 transition-colors"
              style={{ fontSize: 10, color: "#999" }}
            >
              Read &rsaquo;
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
