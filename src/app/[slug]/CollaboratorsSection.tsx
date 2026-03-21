// Server component
import Link from "next/link";

type Collaborator = {
  id:         string;
  name:       string;
  photoUrl:   string | null;
  artistSlug: string | null;
};

export default function CollaboratorsSection({
  collaborators,
}: {
  collaborators: Collaborator[];
}) {
  if (collaborators.length === 0) return null;

  return (
    <section>
      <p
        className="text-[10px] font-bold uppercase mb-3"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        COLLABORATORS
      </p>

      <div className="flex flex-wrap gap-[10px]">
        {collaborators.map((c) => {
          const inner = (
            <>
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photoUrl}
                  alt={c.name}
                  className="object-cover"
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                />
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width:           40,
                    height:          40,
                    borderRadius:    "50%",
                    backgroundColor: "rgba(212,168,67,0.10)",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#D4A843" }}>
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <p
                className="text-center mt-[3px] leading-tight"
                style={{ fontSize: 10, color: "#999", maxWidth: 56 }}
              >
                {c.name}
              </p>
            </>
          );

          return c.artistSlug ? (
            <Link
              key={c.id}
              href={`/${c.artistSlug}`}
              className="flex flex-col items-center no-underline hover:brightness-125 transition-all"
            >
              {inner}
            </Link>
          ) : (
            <div key={c.id} className="flex flex-col items-center">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
