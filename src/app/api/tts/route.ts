import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Text to Speech (TTS) proxy route.
 * 
 * WHY: Receives AI text message from client, verifies Supabase auth,
 * calls OpenAI TTS-1 to synthesize a natural human voice response stream,
 * and streams the MP3 audio bytes directly back to the client for immediate playback.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify User Authentication via Bearer Token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      logger.warn('Failed authentication attempt to /api/tts', authError);
      return NextResponse.json({ error: 'Unauthorized: Invalid session token.' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { text, voice = 'alloy' } = body;

    if (!text) {
      return NextResponse.json({ error: 'Bad Request: Missing text content to synthesize.' }, { status: 400 });
    }

    logger.info(`Synthesizing text: size=${text.length} chars, voice=${voice}`);

    // 3. Request OpenAI TTS-1 Speech Synthesis Stream
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice, // alloy, nova, onyx, echo, fable, shimmer
      input: text,
      response_format: 'mp3',
    });

    // 4. Return as Binary MP3 Stream
    return new NextResponse(mp3Response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (err) {
    logger.error('Unexpected error in /api/tts route', err);
    return NextResponse.json({ error: 'Internal Server Error. TTS compilation failed.' }, { status: 500 });
  }
}
