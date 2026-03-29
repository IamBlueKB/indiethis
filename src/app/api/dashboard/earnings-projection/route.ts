import { NextResponse }       from "next/server";
import { auth }               from "@/lib/auth";
import { projectEarnings }    from "@/lib/earnings-projector";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await projectEarnings(session.user.id);
  return NextResponse.json({ data });
}
