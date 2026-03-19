import { EyeOff } from "lucide-react";

export default function AdminViewOnlyBanner({ page }: { page: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm mb-5"
      style={{
        backgroundColor: "rgba(212,168,67,0.08)",
        borderColor: "rgba(212,168,67,0.3)",
        color: "#D4A843",
      }}
    >
      <EyeOff size={15} className="shrink-0" />
      <span>
        <strong>View-only access.</strong> You can browse {page} data but cannot make changes.
        Contact a Super Admin to request elevated permissions.
      </span>
    </div>
  );
}
