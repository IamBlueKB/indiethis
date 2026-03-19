"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import CreateAdminModal from "@/components/admin/CreateAdminModal";

export default function TeamActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#E85D4A" }}
      >
        <UserPlus size={15} />
        Create Admin
      </button>

      {open && <CreateAdminModal onClose={() => setOpen(false)} />}
    </>
  );
}
