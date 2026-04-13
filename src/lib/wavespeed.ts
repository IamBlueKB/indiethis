/**
 * src/lib/wavespeed.ts
 *
 * WaveSpeed Prompt Optimizer — stub (Step 5 will complete this).
 *
 * Optimizes video generation prompts for specific fal.ai models using
 * WaveSpeed's prompt enhancement API. Falls back to the original prompt
 * gracefully if the API key is missing or the request fails.
 */

export async function optimizeVideoPrompt(
  prompt: string,
  targetModel?: string,
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;

  if (!apiKey) {
    // No key configured — return original prompt unchanged
    return prompt;
  }

  try {
    const response = await fetch(
      "https://api.wavespeed.ai/api/v3/models/wavespeed-ai/prompt-optimizer",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          ...(targetModel && { target_model: targetModel }),
        }),
      },
    );

    if (!response.ok) {
      console.error(`[WaveSpeed] Failed: ${response.status}`);
      return prompt;
    }

    const data = await response.json() as Record<string, unknown>;
    const optimized =
      (data.optimized_prompt as string | undefined) ??
      ((data.data as Record<string, unknown> | undefined)?.optimized_prompt as string | undefined) ??
      prompt;

    return optimized;
  } catch (error) {
    console.error("[WaveSpeed] Error:", error);
    return prompt;
  }
}
