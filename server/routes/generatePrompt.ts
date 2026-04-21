import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { openai, getModel } from '../lib/openai.js';

const router = Router();

router.post('/generate-prompt', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { aiDescription, userDescription } = req.body;

    if (!aiDescription) {
      res.status(400).json({ error: 'AI description is required' });
      return;
    }

    const model = getModel();

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
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const prompt = response.choices[0]?.message?.content || 'Unable to generate prompt';

    res.json({ prompt });
  } catch (error) {
    console.error('Error generating prompt:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate prompt'
    });
  }
});

export default router;
