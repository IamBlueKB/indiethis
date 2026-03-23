import { notFound } from "next/navigation";
import SplitReviewClient from "./SplitReviewClient";

type Props = { params: Promise<{ token: string }> };

export default async function SplitReviewPage({ params }: Props) {
  const { token } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  const res = await fetch(`${baseUrl}/api/splits/review/${token}`, { cache: "no-store" });

  if (!res.ok) notFound();

  const data = await res.json();

  return <SplitReviewClient token={token} initialData={data} />;
}
