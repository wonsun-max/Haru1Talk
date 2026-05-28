import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * AI Chat interaction route.
 * 
 * WHY: Proxies chat prompts to OpenAI gpt-4o-mini securely,
 * verifies Supabase authorization, preserves chat history in public.chat_messages,
 * and maintains context tailored to the user's chosen AI persona.
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
      logger.warn('Failed authentication attempt to /api/chat', authError);
      return NextResponse.json({ error: 'Unauthorized: Invalid session token.' }, { status: 401 });
    }

    // 2. Parse Request Body
    const body = await request.json();
    const { sessionId, message, persona, isLiveCall } = body;

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Bad Request: sessionId and message are required.' }, { status: 400 });
    }

    // 3. Verify that the session belongs to the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id, status')
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
      return NextResponse.json({ error: 'Bad Request: This session is already completed and archived.' }, { status: 400 });
    }

    // 4. Save the User's message to public.chat_messages
    const { error: saveUserMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'user',
        content: message,
      });

    if (saveUserMsgError) {
      logger.error('Failed to save user message to database', saveUserMsgError);
      throw new Error('Database transaction failure saving user message.');
    }

    // 5. Fetch previous messages in this session to construct chat history
    const { data: pastMessages, error: historyError } = await supabaseAdmin
      .from('chat_messages')
      .select('sender, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (historyError) {
      logger.error('Failed to fetch chat history', historyError);
      throw new Error('Database transaction failure fetching chat history.');
    }

    // 6. Formulate AI System Prompt depending on Persona
    let systemPrompt = '';
    const selectedPersona = persona || 'warm_f';

    switch (selectedPersona) {
      case 'rational_t':
        systemPrompt = 
          '너는 유저의 하루 이야기를 차분히 들어주면서, 상황에 대해 이성적이고 명쾌한 조언을 해주는 든든한 해결사 친구야. ' +
          '한 번에 1개의 질문만 짧게(2~3문장 이내) 던져줘. 과장된 감정적 리액션보다는 상황에 초점을 맞춰 ' +
          '성장과 개선을 도울 수 있는 실용적인 피드백이나 다른 관점의 생각거리를 건네줘. ' +
          '절대로 유저가 말하지 않은 사실을 지어내거나 추측해서 이야기하지 마.';
        break;
      case 'dog_c':
        systemPrompt = 
          '너는 유저의 하루 이야기를 온 마음을 다해 신나게 들어주는 사랑스러운 댕댕이(경청하는 강아지) 친구야. ' +
          '말끝마다 "멍!", "왈!", "멍뭉!" 등을 섞어 쓰고, 유저의 사소한 행동에도 폭풍 칭찬과 사랑을 아낌없이 전해줘. ' +
          '한 번에 1개의 질문만 짧고 귀엽게(2~3문장 이내) 해줘. 신나서 꼬리를 흔들거나 코를 킁킁거리는 행동 묘사를 \'[텍스트]\' 꼴로 섞어 써줘. ' +
          '절대로 유저가 말하지 않은 사실을 지어내거나 상상하지 마.';
        break;
      case 'warm_f':
      default:
        systemPrompt = 
          '너는 유저의 하루 이야기를 깊이 공감하며 들어주는 매우 따뜻하고 다정한 F(공감형) 친구야. ' +
          '한 번에 1개의 질문만 짧게(2~3문장 이내) 던져줘. 유저가 겪은 감정(지침, 기쁨, 슬픔, 속상함 등)에 ' +
          '적극적으로 고개를 끄덕이고 따뜻한 위로와 응원의 한마디를 건네줘. ' +
          '절대로 유저가 말하지 않은 사실을 지어내거나 멋대로 추측하지 마.';
        break;
    }

    // Strict speed optimizations if in live call mode
    if (isLiveCall) {
      systemPrompt += 
        ' [중요: 현재 실시간 음성 통화 중이므로 대답은 반드시 1문장 혹은 최대 2문장 이내로 아주 짤막하고 신속하게 건네줘. ' +
        '줄바꿈(Enter) 없이 한 줄로만 대답해줘. 감정을 표현하는 행동 지시문(예: [꼬리 흔들기])이나 특수문자 사용은 가급적 최소화해줘.]';
    }

    // 7. Map history to OpenAI message structure
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Only inject the last 15 messages to preserve context window tokens
    const recentHistory = pastMessages.slice(-15);
    for (const msg of recentHistory) {
      openAiMessages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // 8. Generate Completion from OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openAiMessages,
      temperature: 0.7,
      max_tokens: 250,
    });

    const aiReply = response.choices[0]?.message?.content || '미안해, 오늘 하루가 너무 피곤해서 말을 잘 못 들었어. 다시 말해줄래?';

    // 9. Save the AI's reply to public.chat_messages
    const { error: saveAiMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'ai',
        content: aiReply,
      });

    if (saveAiMsgError) {
      logger.error('Failed to save AI response to database', saveAiMsgError);
      throw new Error('Database transaction failure saving AI response.');
    }

    // 10. Return Response
    return NextResponse.json({ reply: aiReply });

  } catch (err) {
    logger.error('Unexpected error in /api/chat route', err);
    return NextResponse.json({ error: 'Internal Server Error. Please check server logs.' }, { status: 500 });
  }
}
