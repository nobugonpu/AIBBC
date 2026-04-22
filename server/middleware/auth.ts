import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthRequest extends Request {
  userId?: string;
}

export async function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log('[auth] Authenticating request...');
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[auth] Missing or invalid authorization header');
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    console.log('[auth] Token present, verifying with Supabase...');

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('[auth] Invalid or expired token:', error?.message);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    console.log('[auth] User authenticated:', user.id);
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('[auth] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
