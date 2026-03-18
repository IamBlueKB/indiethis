/**
 * Remotion entry point — registers all compositions with the bundler.
 *
 * Bundle and deploy to Lambda:
 *   cd remotion
 *   npm install
 *   npx remotion lambda sites create src/index.ts --site-name=indiethis-lyric-video
 *
 * Copy the returned serve URL into .env as REMOTION_SERVE_URL.
 */
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
