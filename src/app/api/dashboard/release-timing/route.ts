import { NextResponse }           from "next/server";
import { auth }                   from "@/lib/auth";
import { analyzeReleaseTiming }   from "@/lib/release-timing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await analyzeReleaseTiming(session.user.id);
  return NextResponse.json({ data });
}
