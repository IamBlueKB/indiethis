import { notFound } from "next/navigation";
import YearInReviewPage from "@/components/dashboard/YearInReview";

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `${year} Year in Review – IndieThis` };
}

export default async function YearInReviewYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2020 || year > 2100) notFound();
  return <YearInReviewPage year={year} />;
}
