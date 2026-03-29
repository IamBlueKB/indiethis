import YearInReviewPage from "@/components/dashboard/YearInReview";

export const metadata = { title: "Year in Review – IndieThis" };

export default function YearInReviewCurrentPage() {
  const year = new Date().getFullYear();
  return <YearInReviewPage year={year} />;
}
