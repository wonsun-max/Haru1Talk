import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Speech to Text (STT) proxy route.
 * 
 * WHY: Receives voice recording blobs from the client, verifies Supabase auth,
 * proxies the audio file stream to OpenAI Whisper API in-memory (preventing local disk writes),
 * and returns the transcribed Korean text with optimal recognition rates.
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
      logger.warn('Failed authentication attempt to /api/stt', authError);
      return NextResponse.json({ error: 'Unauthorized: Invalid session token.' }, { status: 401 });
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Bad Request: Missing audio file.' }, { status: 400 });
    }

    logger.info(`Received STT audio file: name=${file.name}, size=${file.size} bytes, type=${file.type}`);

    // 3. Call OpenAI Whisper-1 Audio Transcriptions API
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'ko', // Strict Korean recognition
    });

    const transcriptionText = response.text || '';
    logger.info('Successfully transcribed audio with Whisper');

    return NextResponse.json({ text: transcriptionText });

  } catch (err) {
    logger.error('Unexpected error in /api/stt route', err);
    return NextResponse.json({ error: 'Internal Server Error. Whisper processing failed.' }, { status: 500 });
  }
}
