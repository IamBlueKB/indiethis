/**
 * GET /api/mix-console/debug
 * Temporary: tests Replicate prediction creation from Vercel function env.
 * DELETE after debugging.
 */
import { NextResponse } from "next/server";
import Replicate from "replicate";

export const maxDuration = 30;

export async function GET() {
  const MIX_VERSION = process.env.REPLICATE_MIX_MODEL_VERSION ?? process.env.REPLICATE_MASTERING_MODEL_VERSION ?? "";
  const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN ?? "";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const replicate = new Replicate({ auth: REPLICATE_TOKEN });

  let predictionResult: unknown = null;
  let predictionError: string | null = null;

  try {
    const prediction = await replicate.predictions.create({
      version: MIX_VERSION,
      input: {
        action: "health",
        supabase_url: process.env.SUPABASE_URL ?? "",
        supabase_service_key: process.env.SUPABASE_SERVICE_KEY ?? "",
      },
      webhook: `${APP_URL}/api/mix-console/webhook/replicate/analyze`,
      webhook_events_filter: ["completed"],
    });
    predictionResult = { id: prediction.id, status: (prediction as any).status };
  } catch (err) {
    predictionError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    mixVersion:       MIX_VERSION,
    versionFirst8:    MIX_VERSION.slice(0, 8),
    tokenPrefix:      REPLICATE_TOKEN.slice(0, 8),
    appUrl:           APP_URL,
    predictionResult,
    predictionError,
  });
}
