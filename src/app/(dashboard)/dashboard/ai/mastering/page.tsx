/**
 * /dashboard/ai/mastering — Legacy redirect
 *
 * The Auphonic-based mastering tool has been replaced by the
 * AI Mix & Master Studio at /dashboard/ai/master.
 * This redirect preserves any bookmarks or direct links.
 */

import { redirect } from "next/navigation";

export default function LegacyMasteringPage() {
  redirect("/dashboard/ai/master");
}
