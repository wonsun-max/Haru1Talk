import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Badge milestone definitions ordered by ascending streak requirement.
 * WHY: Centralising milestones here ensures the streak update logic
 * and any future badge display code share a single source of truth.
 */
const BADGE_MILESTONES: { key: string; streak: number }[] = [
  { key: 'flame_3',   streak: 3   },
  { key: 'star_7',    streak: 7   },
  { key: 'moon_14',   streak: 14  },
  { key: 'galaxy_30', streak: 30  },
  { key: 'legend_100',streak: 100 },
];

interface StreakUpdateResult {
  currentStreak: number;
  longestStreak: number;
  totalDiaries: number;
  badges: string[];
  /** Newly unlocked badge key, or null if none was earned this write. */
  newBadge: string | null;
}

/**
 * Upserts the user_streaks row after a successful diary save.
 *
 * WHY: Runs as a non-fatal side-effect after diary persistence. If this
 * function throws, the diary response is still returned — streak state is
 * eventually consistent rather than transactionally coupled to diary writes.
 */
async function updateUserStreak(userId: string, diaryDateStr: string): Promise<StreakUpdateResult> {
  const todayKst = diaryDateStr; // YYYY-MM-DD already in KST from request body

  // Fetch existing streak record (may not exist for first-time users)
  const { data: existing } = await supabaseAdmin
    .from('user_streaks')
    .select('current_streak, longest_streak, last_diary_date, total_diaries, badges')
    .eq('user_id', userId)
    .single();

  const prev = existing ?? {
    current_streak: 0,
    longest_streak: 0,
    last_diary_date: null as string | null,
    total_diaries: 0,
    badges: [] as string[],
  };

  // Guard: if diary was already counted today, return unchanged state
  if (prev.last_diary_date === todayKst) {
    return {
      currentStreak: prev.current_streak,
      longestStreak: prev.longest_streak,
      totalDiaries: prev.total_diaries,
      badges: prev.badges,
      newBadge: null,
    };
  }

  // Compute new streak: +1 if yesterday's date matches last_diary_date, else reset to 1
  const yesterday = new Date(todayKst);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = prev.last_diary_date === yesterdayStr ? prev.current_streak + 1 : 1;
  const newLongest = Math.max(prev.longest_streak, newStreak);
  const newTotal = prev.total_diaries + 1;

  // Determine if any new badge was just unlocked
  const existingBadgeSet = new Set<string>(prev.badges);
  let newBadge: string | null = null;
  for (const milestone of BADGE_MILESTONES) {
    if (newStreak >= milestone.streak && !existingBadgeSet.has(milestone.key)) {
      existingBadgeSet.add(milestone.key);
      newBadge = milestone.key; // Surface the highest newly-earned badge
    }
  }
  const updatedBadges = Array.from(existingBadgeSet);

  // Upsert the streak row (INSERT or UPDATE based on PK collision)
  const { error: upsertError } = await supabaseAdmin
    .from('user_streaks')
    .upsert({
      user_id: userId,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_diary_date: todayKst,
      total_diaries: newTotal,
      badges: updatedBadges,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertError) {
    logger.error('Failed to upsert user_streaks — non-fatal, diary already saved', upsertError);
  }

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    totalDiaries: newTotal,
    badges: updatedBadges,
    newBadge,
  };
}

/**
 * AI Diary Summarization Route.
 * 
 * WHY: Processes active chat logs, distills major events and primary emotions
 * using OpenAI JSON Mode (gpt-4o-mini), saves the final diary row to public.diaries,
 * and updates the public.chat_sessions status to 'completed' as a atomic operation.
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
      logger.warn('Failed authentication attempt to /api/summarize', authError);
      return NextResponse.json({ error: 'Unauthorized: Invalid session token.' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { sessionId, date } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Bad Request: sessionId is required.' }, { status: 400 });
    }

    const diaryDate = date || new Date().toISOString().split('T')[0];

    // 3. Verify chat session ownership and status
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id, status, persona')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      logger.error('Error fetching chat session details', sessionError);
      return NextResponse.json({ error: 'Forbidden: Chat session not found.' }, { status: 404 });
    }

    if (sessionData.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this chat session.' }, { status: 403 });
    }

    if (sessionData.status === 'completed') {
      // WHY: Self-healing — if a diary was already created (e.g. from double submission or retried network call),
      // return the existing diary record instead of rejecting with an error.
      const { data: existingDiary, error: fetchError } = await supabaseAdmin
        .from('diaries')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!fetchError && existingDiary) {
        logger.info(`Session=${sessionId} is already completed. Returning existing diary (self-healing).`);
        return NextResponse.json({ diary: existingDiary });
      }

      return NextResponse.json({ error: 'Bad Request: A diary has already been generated for this session.' }, { status: 400 });
    }

    // 4. Retrieve all messages from the session
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('sender, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError || !messages || messages.length === 0) {
      logger.error('Failed or empty messages retrieved for summary', messagesError);
      return NextResponse.json({ error: 'Bad Request: Cannot generate a diary from an empty conversation.' }, { status: 400 });
    }

    // Senior Developer Constraint Check: Strictly prohibit diary summarization with zero user dialogue turns
    const userTurns = messages.filter((msg) => msg.sender === 'user');
    if (userTurns.length === 0) {
      logger.warn(`Diary summary rejected: zero user turns in session=${sessionId}`);
      return NextResponse.json({
        error: 'Bad Request: 최소 1회 이상 대화를 나눠야 오늘의 일기가 생성될 수 있습니다. 대화방에서 속마음을 들려주세요!'
      }, { status: 400 });
    }

    // 5. Compile chat script for the AI prompt
    const chatTranscript = messages
      .map((msg) => `${msg.sender === 'user' ? '유저' : 'AI'}: ${msg.content}`)
      .join('\n');

    // 6. Formulate specialized prompt utilizing JSON Mode
    const systemPrompt = 
      '너는 제공된 대화 기록을 분석하여 유저의 하루를 아름다운 1인칭 시점의 일기로 요약해주는 최고의 전문 일기 작가 AI야. ' +
      '반드시 제공된 대화 스크립트에 포함된 사건과 감정만 바탕으로 작성하며, 대화에 등장하지 않는 허구의 사실은 단 1%도 추가하거나 추측하여 지어내지 마. ' +
      '대화 내용이 너무 짧거나 사실이 없으면 있는 정보만 컴팩트하게 정리해. ' +
      '출력은 반드시 한국어로 된 JSON 포맷이어야 하며 아래의 키를 반드시 포함해야 해:\n' +
      '- title: 대화 내용과 오늘의 무드에 어울리는 감성적인 일기 제목 (20자 이내)\n' +
      '- content: 유저가 쓴 것처럼 1인칭 시점("나")의 정돈된 문어체(기승전결 포함) 일기장 본문 (300자 내외)\n' +
      '- emotion: 대화에서 파악된 유저의 핵심 감정 카테고리. 오직 다음 5가지 영문 키 중 가장 우세한 하나만 골라야 해: "happy", "sad", "calm", "tired", "angry"\n' +
      '- sentimentScore: 유저의 오늘의 긍정적 에너지/행복도 지수. 0.0(최악의 피로/슬픔/화)에서 10.0(최고의 기쁨/평온) 사이의 실수(float) 수치 부여.\n\n' +
      '반드시 올바른 JSON 문자열만 출력해줘.';

    // 7. Request OpenAI JSON completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `이하 대화 스크립트:\n\n${chatTranscript}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const resultText = response.choices[0]?.message?.content || '{}';
    const parsedDiary = JSON.parse(resultText);

    if (!parsedDiary.title || !parsedDiary.content || !parsedDiary.emotion) {
      throw new Error('AI summary failed to return correct JSON schema fields.');
    }

    // 8. Save the generated diary to DB
    const { data: diaryData, error: saveDiaryError } = await supabaseAdmin
      .from('diaries')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        date: diaryDate,
        title: parsedDiary.title,
        content: parsedDiary.content,
        emotion: parsedDiary.emotion,
        sentiment_score: parsedDiary.sentimentScore || 5.0,
      })
      .select()
      .single();

    if (saveDiaryError) {
      // WHY: 23505 = PostgreSQL unique_violation. Handles race-condition where two near-simultaneous
      // requests both pass the 'completed' check, but the second one hits a unique constraint on the insert.
      // Self-healing: fetch and return the winning insert's record rather than throwing 500.
      if ((saveDiaryError as { code?: string }).code === '23505') {
        logger.warn(`Duplicate diary insert (23505) detected for session=${sessionId}. Fetching existing record.`);
        const { data: existingDiary } = await supabaseAdmin
          .from('diaries')
          .select('*')
          .eq('session_id', sessionId)
          .single();
        if (existingDiary) {
          return NextResponse.json({ diary: existingDiary });
        }
      }
      logger.error('Failed to write diary to database', saveDiaryError);
      throw new Error('Database transaction failure writing diary.');
    }

    // 9. Update the session status to 'completed'
    const { error: updateSessionError } = await supabaseAdmin
      .from('chat_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);

    if (updateSessionError) {
      // WHY: Non-fatal. The diary record is already saved. Log the anomaly and continue.
      // A reconciliation job or next diary fetch will detect the completed status via diary presence.
      logger.error('Failed to update chat session status to completed — diary saved but session status stale', updateSessionError);
    }

    logger.info(`Diary generated successfully for session=${sessionId}`);

    // 10. Update user streak — non-fatal side-effect after diary is persisted
    let streakResult: StreakUpdateResult | null = null;
    try {
      streakResult = await updateUserStreak(user.id, diaryDate);
      if (streakResult.newBadge) {
        logger.info(`Badge unlocked: user=${user.id}, badge=${streakResult.newBadge}, streak=${streakResult.currentStreak}`);
      }
    } catch (streakErr) {
      // WHY: Streak failure must never block the diary response — eventual consistency is acceptable here.
      logger.error('Non-fatal streak update failure after diary save', streakErr);
    }

    // 11. Return diary + streak metadata (newBadge triggers confetti modal on client)
    return NextResponse.json({
      diary: diaryData,
      streak: streakResult ? {
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        totalDiaries: streakResult.totalDiaries,
        newBadge: streakResult.newBadge,
      } : null,
    });

  } catch (err) {
    logger.error('Unexpected error in /api/summarize route', err);
    return NextResponse.json({ error: 'Internal Server Error. Diary summarization failed.' }, { status: 500 });
  }
}
