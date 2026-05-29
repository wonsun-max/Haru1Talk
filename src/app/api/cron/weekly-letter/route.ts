import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/** Milestone badge definitions in ascending order. */
const BADGE_MILESTONES: Record<string, number> = {
  flame_3: 3,
  star_7: 7,
  moon_14: 14,
  galaxy_30: 30,
  legend_100: 100,
};

/**
 * Generates a poetic weekly retrospective letter from a user's diary entries.
 *
 * WHY: Distills emotional arcs and key moments from raw diary data into a
 * warm, literary 1st-person letter using OpenAI JSON mode — the same
 * battle-tested pattern as /api/summarize.
 */
async function generateWeeklyLetter(
  diaries: Array<{ date: string; title: string; content: string; emotion: string; sentiment_score: number }>
): Promise<{ subject: string; content: string } | null> {
  try {
    const diaryScript = diaries
      .map((d) => `[${d.date}] 제목: ${d.title}\n감정: ${d.emotion} (점수: ${d.sentiment_score})\n내용: ${d.content}`)
      .join('\n\n---\n\n');

    const systemPrompt =
      '너는 유저의 지난 7일간의 일기를 읽고, 친한 친구가 쓴 것처럼 따뜻하고 문학적인 회고 편지를 써주는 감성 AI야. ' +
      '반드시 제공된 일기 내용과 감정에만 기반해서 작성하며, 없는 사실을 지어내지 마. ' +
      '출력은 반드시 한국어 JSON 포맷이어야 하며 아래 키를 포함해야 해:\n' +
      '- subject: 이번 주를 함축하는 감성적인 편지 제목 (30자 이내)\n' +
      '- content: "나에게" 쓰는 1인칭 편지. 400~600자. 이번 주 감정 흐름, 기억에 남는 순간, ' +
      '다음 주에 대한 따뜻한 응원을 포함. 기승전결 있는 문어체.\n\n' +
      '반드시 올바른 JSON 문자열만 출력해줘.';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `이하 이번 주 일기 목록:\n\n${diaryScript}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    if (!parsed.subject || !parsed.content) return null;
    return { subject: parsed.subject, content: parsed.content };
  } catch (err) {
    logger.error('Failed to generate weekly letter via OpenAI', err);
    return null;
  }
}

/**
 * Dispatches the weekly letter to the user via KakaoTalk (Feed Message).
 *
 * WHY: Reuses the exact same KakaoTalk Memo API call pattern established
 * in /api/cron/notifications to maintain a single integration surface.
 */
async function dispatchKakaoWeeklyLetter(
  accessToken: string,
  nickname: string,
  subject: string,
  preview: string
): Promise<boolean> {
  try {
    const templateObject = {
      object_type: 'feed',
      content: {
        title: `✉️ ${nickname}님께 이번 주 편지가 도착했어요`,
        description: `"${subject}"\n\n${preview}...`,
        image_url: 'https://haru1talk.vercel.app/logo.png',
        image_width: 800,
        image_height: 400,
        link: {
          web_url: 'https://haru1talk.vercel.app/dashboard',
          mobile_web_url: 'https://haru1talk.vercel.app/dashboard',
        },
      },
      buttons: [
        {
          title: '편지 전체 읽기',
          link: {
            web_url: 'https://haru1talk.vercel.app/dashboard',
            mobile_web_url: 'https://haru1talk.vercel.app/dashboard',
          },
        },
      ],
    };

    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }).toString(),
    });

    const result = await response.json();
    if (!response.ok) {
      logger.error('Failed to send KakaoTalk weekly letter', result);
      return false;
    }
    logger.info(`KakaoTalk weekly letter dispatched to ${nickname}`);
    return true;
  } catch (err) {
    logger.error('Error dispatching KakaoTalk weekly letter', err);
    return false;
  }
}

/**
 * Dispatches the weekly letter to the user via Resend (Gmail HTML email).
 *
 * WHY: Mirrors the dark starry-night aesthetic of the daily notification emails
 * but with an expanded layout to showcase the full letter content inline.
 */
async function dispatchResendWeeklyLetter(
  emailAddress: string,
  nickname: string,
  subject: string,
  content: string,
  avgSentiment: number,
  diaryCount: number
): Promise<boolean> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey.includes('placeholder')) {
      logger.warn('Resend API key missing. Skipping weekly letter email.');
      return false;
    }

    const sentimentBar = Math.round((avgSentiment / 10) * 100);
    const htmlContent = `
      <div style="background-color: #02020a; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 540px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 32px; margin-bottom: 8px;">✉️</div>
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">이번 주의 나에게 쓰는 편지</h1>
          <p style="color: #a78bfa; font-size: 13px; margin: 0;">${nickname}님, 하루톡이 보냈어요</p>
        </div>

        <div style="background: linear-gradient(135deg, rgba(167,139,250,0.08), rgba(99,102,241,0.08)); border: 1px solid rgba(167,139,250,0.2); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #c4b5fd; font-size: 15px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">"${subject}"</h2>
          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.8; margin: 0; white-space: pre-wrap;">${content}</p>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <div style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 4px;">📓</div>
            <div style="color: #ffffff; font-size: 16px; font-weight: 800;">${diaryCount}편</div>
            <div style="color: #64748b; font-size: 10px;">이번 주 일기</div>
          </div>
          <div style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 14px;">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">이번 주 감정 지수</div>
            <div style="background: rgba(255,255,255,0.05); border-radius: 99px; height: 6px; overflow: hidden;">
              <div style="background: linear-gradient(to right, #a855f7, #6366f1); height: 100%; width: ${sentimentBar}%; border-radius: 99px;"></div>
            </div>
            <div style="color: #ffffff; font-size: 13px; font-weight: 700; margin-top: 6px;">${avgSentiment.toFixed(1)} / 10.0</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 28px;">
          <a href="https://haru1talk.vercel.app/dashboard" style="background: linear-gradient(to right, #a855f7, #6366f1); color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: bold; border-radius: 10px; display: inline-block;">
            대시보드에서 편지 보기 →
          </a>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; font-size: 10px; color: #475569; text-align: center;">
          © 2026 Haru Talk Team. 이 편지는 하루톡 AI가 ${nickname}님의 이번 주 일기를 분석해서 자동으로 작성했습니다.
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Haru Talk <noreply@harutalk.shop>',
        to: emailAddress,
        subject: `[하루톡] ✉️ 이번 주 나에게 쓰는 편지 — ${subject}`,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      logger.error('Failed to send weekly letter email via Resend', result);
      return false;
    }
    logger.info(`Weekly letter email dispatched to ${nickname} (${emailAddress})`);
    return true;
  } catch (err) {
    logger.error('Error dispatching Resend weekly letter email', err);
    return false;
  }
}

/**
 * Weekly Letter Cron Route.
 *
 * WHY: Triggered every Monday 07:00 KST (UTC Sunday 22:00) via Vercel Cron.
 * For each user with at least 1 diary in the last 7 days, generates and stores
 * a personalized AI letter, then dispatches it via their preferred channel.
 * Supports ?debug=true for local testing without auth header verification.
 */
export async function GET(request: NextRequest) {
  try {
    const isDebug = request.nextUrl.searchParams.get('debug') === 'true';

    // 1. Verify Vercel Cron authorization
    if (!isDebug) {
      const authHeader = request.headers.get('Authorization');
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Unauthorized weekly-letter cron trigger blocked.');
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
    }

    // 2. Compute week_start: Monday of the previous week in KST
    const now = new Date();
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffsetMs);

    // Rewind to last Monday (day 1 = Mon in ISO; JS 0=Sun,1=Mon...)
    const dayOfWeek = kstNow.getUTCDay(); // 0=Sun, 1=Mon
    // In debug mode, use the current week's Monday for testing
    const daysToMonday = isDebug ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1) : (dayOfWeek === 1 ? 7 : (dayOfWeek === 0 ? 13 : dayOfWeek + 6));
    const weekStartDate = new Date(kstNow);
    weekStartDate.setUTCDate(kstNow.getUTCDate() - daysToMonday);
    const weekStart = weekStartDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    logger.info(`Weekly Letter Cron: Processing week ${weekStart} → ${weekEnd} (debug=${isDebug})`);

    // 3. Fetch all users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError || !users) {
      logger.error('Failed to fetch users for weekly letter cron', usersError);
      return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
    }

    let processed = 0;
    let skipped = 0;
    let dispatched = { kakao: 0, email: 0 };

    for (const user of users) {
      try {
        // 4. Check if a letter for this week already exists (idempotency)
        const { data: existing } = await supabaseAdmin
          .from('weekly_letters')
          .select('id')
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
          .single();

        if (existing) {
          logger.info(`Weekly letter already exists for user=${user.id}, week=${weekStart}. Skipping.`);
          skipped++;
          continue;
        }

        // 5. Fetch last 7 days of diaries for this user
        const { data: diaries, error: diariesError } = await supabaseAdmin
          .from('diaries')
          .select('date, title, content, emotion, sentiment_score')
          .eq('user_id', user.id)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date', { ascending: true });

        if (diariesError || !diaries || diaries.length === 0) {
          logger.info(`No diaries found for user=${user.id} in week=${weekStart}. Skipping.`);
          skipped++;
          continue;
        }

        // 6. Compute aggregate stats
        const avgSentiment = parseFloat(
          (diaries.reduce((sum, d) => sum + Number(d.sentiment_score), 0) / diaries.length).toFixed(1)
        );
        const emotionCounts: Record<string, number> = {};
        for (const d of diaries) {
          emotionCounts[d.emotion] = (emotionCounts[d.emotion] || 0) + 1;
        }
        const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0];

        // 7. Generate AI letter
        const letter = await generateWeeklyLetter(diaries);
        if (!letter) {
          logger.warn(`Failed to generate weekly letter for user=${user.id}. Skipping.`);
          skipped++;
          continue;
        }

        // 8. Persist letter to DB (UNIQUE constraint prevents duplicates under race conditions)
        const { error: insertError } = await supabaseAdmin
          .from('weekly_letters')
          .insert({
            user_id: user.id,
            week_start: weekStart,
            subject: letter.subject,
            content: letter.content,
            avg_sentiment: avgSentiment,
            dominant_emotion: dominantEmotion,
            diary_count: diaries.length,
          });

        if (insertError) {
          // WHY: code 23505 = unique_violation. Another concurrent cron invocation won the race.
          if ((insertError as { code?: string }).code === '23505') {
            logger.warn(`Duplicate weekly letter insert blocked for user=${user.id}. Concurrent cron winner took it.`);
          } else {
            logger.error(`Failed to save weekly letter for user=${user.id}`, insertError);
          }
          skipped++;
          continue;
        }

        processed++;

        // 9. Dispatch notification
        const meta = user.user_metadata;
        const nickname = meta?.full_name || meta?.name || meta?.nickname ||
          meta?.kakao_account?.profile?.nickname || user.email?.split('@')[0] || '하루톡 친구';
        const provider = meta?.oauth_provider || 'email';
        const preview = letter.content.slice(0, 60).replace(/\n/g, ' ');

        if (provider === 'kakao' && meta?.kakao_access_token) {
          const ok = await dispatchKakaoWeeklyLetter(meta.kakao_access_token, nickname, letter.subject, preview);
          if (ok) {
            dispatched.kakao++;
          } else if (user.email) {
            const emailOk = await dispatchResendWeeklyLetter(user.email, nickname, letter.subject, letter.content, avgSentiment, diaries.length);
            if (emailOk) dispatched.email++;
          }
        } else if (user.email) {
          const ok = await dispatchResendWeeklyLetter(user.email, nickname, letter.subject, letter.content, avgSentiment, diaries.length);
          if (ok) dispatched.email++;
        }
      } catch (userErr) {
        logger.error(`Unexpected error processing weekly letter for user=${user.id}`, userErr);
        skipped++;
      }
    }

    logger.info(`Weekly Letter Cron complete: processed=${processed}, skipped=${skipped}, kakao=${dispatched.kakao}, email=${dispatched.email}`);

    return NextResponse.json({
      success: true,
      weekStart,
      weekEnd,
      debug: isDebug,
      processed,
      skipped,
      dispatched,
    });
  } catch (err) {
    logger.error('Unexpected failure in weekly-letter cron route', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
