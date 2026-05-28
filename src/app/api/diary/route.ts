import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

/**
 * Administrative Diary CRUD Proxy Route.
 * 
 * WHY: Supabase local schema RLS lacks client-side UPDATE policies on diaries table.
 * This route securely proxies authenticated creations and updates on the server-side,
 * ensuring strict JWT verification, owner identity verification, and correct foreign-key
 * session bootstrapping before committing changes.
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
      logger.warn('Failed administrative authentication verification in /api/diary', authError);
      return NextResponse.json({ error: 'Unauthorized: Invalid session token.' }, { status: 401 });
    }

    // 2. Parse payload request parameters
    const body = await request.json();
    const { action, diaryId, title, content, emotion, sentiment_score, date } = body;

    // A. HANDLE DIARY CREATION FLOW (with session shell bypass)
    if (action === 'create') {
      if (!title || !content || !emotion || !date) {
        return NextResponse.json({ error: 'Bad Request: Missing required creation parameters.' }, { status: 400 });
      }

      // a. Start a completed shell session to satisfy the diaries foreign-key check
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          persona: 'warm_f',
          status: 'completed',
        })
        .select()
        .single();

      if (sessionError || !sessionData) {
        logger.error('Failed to bootstrap completed chat session shell for manual entry', sessionError);
        return NextResponse.json({ error: 'Internal Server Error: Database session provision failure.' }, { status: 500 });
      }

      // b. Safely insert manual diary entry
      const { data: diaryData, error: diaryError } = await supabaseAdmin
        .from('diaries')
        .insert({
          session_id: sessionData.id,
          user_id: user.id,
          date,
          title,
          content,
          emotion,
          sentiment_score: sentiment_score || 5.0,
        })
        .select()
        .single();

      if (diaryError || !diaryData) {
        logger.error('Failed to commit manual diary database insertion', diaryError);
        return NextResponse.json({ error: 'Internal Server Error: Database diary insertion failure.' }, { status: 500 });
      }

      logger.info(`Successfully created manual diary id=${diaryData.id} on date=${date}`);
      return NextResponse.json({ success: true, diary: diaryData });
    } 
    
    // B. HANDLE DIARY INLINE UPDATE FLOW
    if (action === 'update') {
      if (!diaryId || !title || !content || !emotion) {
        return NextResponse.json({ error: 'Bad Request: Missing required update parameters.' }, { status: 400 });
      }

      // a. Verify active ownership of the target diary entry
      const { data: existingDiary, error: selectError } = await supabaseAdmin
        .from('diaries')
        .select('id, user_id')
        .eq('id', diaryId)
        .single();

      if (selectError || !existingDiary) {
        logger.error(`Target diary id=${diaryId} not found during update audit`, selectError);
        return NextResponse.json({ error: 'Forbidden: Diary record not found.' }, { status: 404 });
      }

      if (existingDiary.user_id !== user.id) {
        logger.warn(`Security warning: User=${user.id} tried updating unowned diary=${diaryId}`);
        return NextResponse.json({ error: 'Forbidden: You do not own this diary record.' }, { status: 403 });
      }

      // b. Execute administrative update bypassing standard client-side restrictions
      const { data: updatedDiary, error: updateError } = await supabaseAdmin
        .from('diaries')
        .update({
          title,
          content,
          emotion,
          sentiment_score: sentiment_score || 5.0,
        })
        .eq('id', diaryId)
        .select()
        .single();

      if (updateError || !updatedDiary) {
        logger.error(`Failed executing database update transaction for diary=${diaryId}`, updateError);
        return NextResponse.json({ error: 'Internal Server Error: Database update transaction failure.' }, { status: 500 });
      }

      logger.info(`Successfully verified and updated database diary id=${diaryId}`);
      return NextResponse.json({ success: true, diary: updatedDiary });
    }

    return NextResponse.json({ error: 'Bad Request: Invalid action parameter specified.' }, { status: 400 });

  } catch (err) {
    logger.error('Unexpected error inside /api/diary controller', err);
    return NextResponse.json({ error: 'Internal Server Error. Please contact server administration.' }, { status: 500 });
  }
}
