import { Suspense } from "react";
import { notFound } from "next/navigation";
import { userCanAccessMixConsole } from "@/lib/feature-flags-server";
import MixConsoleWizardClient from "./WizardClient";

export default async function MixConsoleWizardPage() {
  if (!(await userCanAccessMixConsole())) notFound();
  return (
    <Suspense>
      <MixConsoleWizardClient />
    </Suspense>
  );
}
