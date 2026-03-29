import { notFound } from "next/navigation";
import YearInReviewPage from "@/components/dashboard/YearInReview";

export function generateMetadata({ params }: { params: { year: string } }) {
  return { title: `${params.year} Year in Review – IndieThis` };
}

export default function YearInReviewYearPage({ params }: { params: { year: string } }) {
  const year = parseInt(params.year, 10);
  if (isNaN(year) || year < 2020 || year > 2100) notFound();
  return <YearInReviewPage year={year} />;
}
