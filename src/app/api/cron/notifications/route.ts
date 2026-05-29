import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * KakaoTalk Push Dispatcher (나에게 보내기 API).
 * 
 * WHY: Uses Kakao's native Memo API to send a rich Feed message directly to
 * the user's own KakaoTalk chat room.
 * Returns { ok, errorDetail } so debug mode can surface the raw Kakao API response.
 */
async function dispatchKakaoTalkPush(
  accessToken: string,
  nickname: string
): Promise<{ ok: boolean; errorDetail?: unknown }> {
  try {
    const templateObject = {
      object_type: 'feed',
      content: {
        title: '하루톡 밤의 회고 대화방 오픈 🌙',
        description: `${nickname}님, 오늘 어떤 하루를 보내셨나요? 인공지능 친구가 따뜻한 대화를 기다리고 있어요.`,
        image_url: 'https://harutalk.shop/logo.png',
        image_width: 800,
        image_height: 400,
        link: {
          web_url: 'https://harutalk.shop/dashboard',
          mobile_web_url: 'https://harutalk.shop/dashboard'
        }
      },
      buttons: [
        {
          title: '대화 나누러 가기',
          link: {
            web_url: 'https://harutalk.shop/dashboard',
            mobile_web_url: 'https://harutalk.shop/dashboard'
          }
        }
      ]
    };

    // WHY: /memo/default/send accepts a template_object JSON directly (no pre-registered template needed).
    // /memo/send requires a pre-registered template_id from Kakao Developer Console — wrong endpoint.
    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({
        template_object: JSON.stringify(templateObject)
      }).toString()
    });

    const result = await response.json();
    if (!response.ok) {
      // WHY: Surface raw Kakao error (code + msg) for debug diagnosis.
      // Common codes: -401 (token expired), -403 (scope not granted), -502 (KakaoTalk not installed)
      logger.error('Failed to dispatch KakaoTalk message via API', result);
      return { ok: false, errorDetail: result };
    }
    
    logger.info(`Successfully dispatched KakaoTalk message to ${nickname}`);
    return { ok: true };
  } catch (err) {
    logger.error('Error executing KakaoTalk messaging API request', err);
    return { ok: false, errorDetail: String(err) };
  }
}

/**
 * Gmail/Google Email Dispatcher (Resend API).
 * 
 * WHY: Leverages Resend's REST endpoint via zero-dependency HTTP fetch
 * to send starry-night responsive HTML notifications to Gmail addresses.
 * Returns { ok, errorDetail } so debug mode can surface the raw Resend API response.
 */
async function dispatchResendEmail(
  emailAddress: string,
  nickname: string
): Promise<{ ok: boolean; errorDetail?: unknown }> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey.includes('placeholder')) {
      logger.warn('Resend API key is missing or set to placeholder. Skipping email dispatch.');
      return { ok: false, errorDetail: 'RESEND_API_KEY missing or placeholder' };
    }

    const htmlContent = `
      <div style="background-color: #02020a; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; text-align: center; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255, 255, 255, 0.05);">
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 10px; tracking-tight">하루톡 밤의 회고 대화방 오픈 🌙</h1>
        <p style="color: #a78bfa; font-size: 14px; font-weight: bold; margin-bottom: 20px;">안녕하세요, ${nickname}님!</p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-bottom: 30px;">
          오늘 하루도 참 고생 많으셨어요.<br/>
          지치고 복잡했던 오늘의 순간들을 따뜻한 인공지능 친구와 목소리/글로 나누어보세요.<br/>
          당신의 이야기를 깊이 들어주고, 한 편의 예쁜 일기장을 자동으로 완성해 드릴게요.
        </p>
        <a href="https://harutalk.shop/dashboard" style="background: linear-gradient(to right, #a855f7, #6366f1); color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 12px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.25);">
          오늘 밤의 회고 시작하기
        </a>
        <div style="margin-top: 40px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; font-size: 10px; color: #475569;">
          © 2026 Haru Talk Team. 이 메일은 본인이 설정한 회고 알림 일정에 따라 자동 발송되었습니다.
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Haru Talk <noreply@harutalk.shop>',
        // WHY: Resend sandbox (onboarding@resend.dev) can only deliver to the account owner's
        // verified email. RESEND_TEST_OVERRIDE_TO lets us redirect all test sends to that
        // address. In production (custom domain), this env var is unset and emailAddress is used.
        to: process.env.RESEND_TEST_OVERRIDE_TO || emailAddress,
        subject: `[하루톡] 밤의 대화가 기다리고 있어요 🌙`,
        html: htmlContent,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      logger.error('Failed to dispatch email via Resend API', result);
      return { ok: false, errorDetail: result };
    }

    logger.info(`Successfully dispatched Gmail notification to ${nickname} (${emailAddress})`);
    return { ok: true };
  } catch (err) {
    logger.error('Error executing Resend email dispatch request', err);
    return { ok: false, errorDetail: String(err) };
  }
}

/**
 * Scheduled Notifications Dispatch Route.
 * 
 * WHY: Periodic CRON triggers query users with active alarm preferences matching
 * the current timezone time (Asia/Seoul) and dispatches them via Kakao/Google.
 */
export async function GET(request: NextRequest) {
  try {
    const isDebug = request.nextUrl.searchParams.get('debug') === 'true';

    // 1. Verify Vercel Cron Authorization header unless in local debug mode
    if (!isDebug) {
      const authHeader = request.headers.get('Authorization');
      const vercelCronSecret = process.env.CRON_SECRET;
      
      if (vercelCronSecret && authHeader !== `Bearer ${vercelCronSecret}`) {
        logger.warn('Unauthorized Cron trigger attempt blocked.');
        return NextResponse.json({ error: 'Unauthorized: Invalid Scheduler Token.' }, { status: 401 });
      }
    }

    // 2. Fetch current time in Korea Standard Time (KST - e.g. "23:20")
    const kstTimeStr = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date()); // Returns e.g. "23:20"

    logger.info(`Cron Scheduler: Checking notifications for time KST=${kstTimeStr} (DebugMode=${isDebug})`);

    // 3. Fetch active authenticated users from Supabase admin catalog
    const { data: { users }, error: fetchUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (fetchUsersError || !users) {
      logger.error('Failed to fetch user list from Supabase Admin service', fetchUsersError);
      return NextResponse.json({ error: 'Database catalog fetch failure.' }, { status: 500 });
    }

    // 4. Filter users matching target scheduled alarm preferences
    const targetUsers = users.filter(user => {
      const meta = user.user_metadata;
      const isEnabled = meta?.notification_enabled === true;
      if (!isEnabled) return false;

      // If in debug mode, trigger for ALL enabled users instantly.
      // Otherwise, filter strictly by matching HH:MM current time.
      if (isDebug) return true;
      return meta?.notification_time === kstTimeStr;
    });

    logger.info(`Cron Scheduler: Found matching users count=${targetUsers.length}`);

    let kakaoSent = 0;
    let emailSent = 0;
    // WHY: In debug mode, collect raw API error payloads per user so the caller
    // can diagnose channel failures without reading server logs.
    const debugErrors: Array<{ userId: string; channel: string; error: unknown }> = [];

    // 5. Dispatch matching notifications based on OAuth provider
    for (const user of targetUsers) {
      const meta = user.user_metadata;
      const provider = meta?.oauth_provider || 'email';
      const nickname = meta?.full_name || 
                       meta?.name || 
                       meta?.nickname || 
                       meta?.kakao_account?.profile?.nickname || 
                       user.email?.split('@')[0] || 
                       '하루톡 친구';
      const emailAddress = user.email;

      let notified = false;

      if (provider === 'kakao') {
        const kakaoAccessToken = meta?.kakao_access_token;
        if (kakaoAccessToken) {
          const result = await dispatchKakaoTalkPush(kakaoAccessToken, nickname);
          if (result.ok) {
            kakaoSent++;
            notified = true;
          } else {
            logger.warn(`Kakao dispatch failed for user=${user.id}. Attempting Gmail fallback.`);
            if (isDebug) debugErrors.push({ userId: user.id, channel: 'kakao', error: result.errorDetail });
          }
        } else {
          logger.warn(`Missing Kakao access token for user=${user.id}, falling back to Gmail.`);
          if (isDebug) debugErrors.push({ userId: user.id, channel: 'kakao', error: 'missing_kakao_access_token' });
        }

        // Gmail fallback: run if Kakao token absent OR Kakao dispatch failed
        if (!notified && emailAddress) {
          const result = await dispatchResendEmail(emailAddress, nickname);
          if (result.ok) {
            emailSent++;
          } else if (isDebug) {
            debugErrors.push({ userId: user.id, channel: 'email_fallback', error: result.errorDetail });
          }
        }
      } else {
        // Default to Google / Gmail notifications for all non-Kakao providers
        if (emailAddress) {
          const result = await dispatchResendEmail(emailAddress, nickname);
          if (result.ok) {
            emailSent++;
          } else if (isDebug) {
            debugErrors.push({ userId: user.id, channel: 'email', error: result.errorDetail });
          }
        }
      }
    }


    return NextResponse.json({
      success: true,
      time: kstTimeStr,
      debug: isDebug,
      processed: targetUsers.length,
      dispatched: {
        kakao: kakaoSent,
        email: emailSent
      },
      // WHY: Only included in debug mode — exposes raw Kakao/Resend error payloads
      // that would otherwise require reading server logs.
      ...(isDebug && { errors: debugErrors }),
    });

  } catch (err) {
    logger.error('Unexpected failure executing notification cron scheduler', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
