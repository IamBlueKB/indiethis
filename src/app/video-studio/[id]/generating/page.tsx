/**
 * /video-studio/[id]/generating — Generation progress screen
 * Public — accessed after payment or for included-credit videos.
 */

import GeneratingClient from "./GeneratingClient";

export const metadata = {
  title: "Generating Your Music Video — IndieThis",
};

export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GeneratingClient id={id} />;
}
