import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { openai, getModel } from '../lib/openai.js';

const router = Router();

router.post('/analyze-image-test', async (req, res) => {
  console.log('[analyze-image-test] Test endpoint called');
  try {
    const model = getModel();
    console.log('[test] Using model:', model);
    console.log('[test] Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello World"'
        }
      ],
      max_tokens: 10,
    });

    console.log('[test] OpenAI response:', response.choices[0]?.message?.content);
    res.json({ message: 'OpenAI working', response: response.choices[0]?.message?.content });
  } catch (error) {
    console.error('[test] OpenAI error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'OpenAI test failed' });
  }
});

router.post('/analyze-image-noauth', async (req, res) => {
  try {
    console.log('[analyze-image-noauth] Request received');
    const { imageUrl, imageData } = req.body;

    if (!imageUrl && !imageData) {
      console.log('[analyze-image-noauth] Missing image data');
      res.status(400).json({ error: 'Image URL or base64 image data is required' });
      return;
    }

    const model = getModel();
    console.log('[analyze-image-noauth] Using model:', model);

    const imageSource = imageData || imageUrl;
    console.log('[analyze-image-noauth] Image source length:', imageSource.length);

    console.log('[analyze-image-noauth] Calling OpenAI API...');
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please provide a brief, descriptive caption for this image. Keep it concise and focus on the main subject and context.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageSource,
              },
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    const description = response.choices[0]?.message?.content || 'No description available';
    console.log('[analyze-image-noauth] Description generated:', description);

    res.json({ description });
  } catch (error) {
    console.error('[analyze-image-noauth] ERROR:', error);
    console.error('[analyze-image-noauth] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyze image'
    });
  }
});

router.post('/analyze-image', authenticateUser, async (req: AuthRequest, res) => {
  try {
    console.log('[analyze-image] Request received');
    const { imageUrl, imageData } = req.body;

    if (!imageUrl && !imageData) {
      console.log('[analyze-image] Missing image data');
      res.status(400).json({ error: 'Image URL or base64 image data is required' });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const openaiApiKey = process.env.VITE_OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !openaiApiKey) {
      console.error('[analyze-image] Missing environment variables');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const imageSource = imageData || imageUrl;
    console.log('[analyze-image] Image source length:', imageSource.length);
    console.log('[analyze-image] Calling Supabase Edge Function...');

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/analyze-image`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        imageData,
        apiKey: openaiApiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[analyze-image] Edge Function error:', errorData);
      res.status(response.status).json({ error: errorData.error || 'Failed to analyze image' });
      return;
    }

    const data = await response.json();
    console.log('[analyze-image] Description generated:', data.description);

    res.json({ description: data.description });
  } catch (error) {
    console.error('[analyze-image] ERROR:', error);
    console.error('[analyze-image] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyze image'
    });
  }
});

export default router;
