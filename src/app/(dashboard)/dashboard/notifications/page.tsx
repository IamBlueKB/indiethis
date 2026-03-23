import { Suspense } from "react";
import NotificationsContent from "./NotificationsContent";

export const metadata = {
  title: "Notifications — IndieThis",
};

export default function NotificationsPage() {
  return (
    <Suspense>
      <NotificationsContent />
    </Suspense>
  );
}
