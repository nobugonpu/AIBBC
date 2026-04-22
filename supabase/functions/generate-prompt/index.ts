import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { aiDescription, userDescription, apiKey } = await req.json();

    if (!aiDescription) {
      return new Response(
        JSON.stringify({ error: "AI description is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const systemPrompt = `You are an expert at creating detailed, high-quality image generation prompts for AI models like DALL-E, Midjourney, and Stable Diffusion.

Your task is to transform image descriptions into optimized prompts that will generate similar or enhanced versions of the original image.

Guidelines:
- Include specific details about composition, lighting, style, and mood
- Add technical photography terms when relevant (e.g., "bokeh", "golden hour", "wide angle")
- Specify art styles or aesthetics if applicable (e.g., "cinematic", "photorealistic", "minimalist")
- Include quality enhancers like "high detail", "8k resolution", "professional photography"
- Keep the prompt concise but descriptive (2-4 sentences)
- Focus on visual elements that can be recreated

Generate a prompt that would create a similar or enhanced version of the described image.`;

    const userPrompt = userDescription
      ? `Based on this AI analysis: "${aiDescription}"\n\nAnd the user's description: "${userDescription}"\n\nCreate an optimized image generation prompt.`
      : `Based on this image analysis: "${aiDescription}"\n\nCreate an optimized image generation prompt.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const prompt = response.choices[0]?.message?.content || "Unable to generate prompt";

    return new Response(
      JSON.stringify({ prompt }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate prompt",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});