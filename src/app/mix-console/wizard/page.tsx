import { Suspense } from "react";
import MixConsoleWizardClient from "./WizardClient";

export default function MixConsoleWizardPage() {
  return (
    <Suspense>
      <MixConsoleWizardClient />
    </Suspense>
  );
}
