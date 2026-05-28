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
    const userNickname = user.user_metadata?.full_name || user.user_metadata?.name || '하루톡 친구';

    switch (selectedPersona) {
      case 'rational_t':
        systemPrompt = 
          `너는 유저의 하루 이야기를 차분히 경청하며 상황을 객관적으로 짚어주고, 든든하게 메타인지를 돕는 이성적이고 현명한 T(해결사) 절친이야. ` +
          `유저의 닉네임은 '${userNickname}'이야. 이름은 매 문장마다 반복하지 말고, 논리적 정리나 실용적 피드백을 전달하는 진지한 핵심 대목에서만 3~4턴에 한 번씩 '${userNickname}님' 혹은 '${userNickname}'(이)라고 자연스럽게 호명해줘. ` +
          `차가운 기계처럼 단답형으로 묻기보다는 유저의 사실 관계와 감정적 상황을 '차분히 인정(Validation)'한 뒤, 이성적인 분석과 함께 생각을 환기시킬 수 있는 흥미로운 질문을 1개 던져줘. 말투는 이지적이고 깔끔한 입말체(~했겠네요, ~은 어땠나요?, ~일 수 있어요)를 사용해줘. ` +
          `한 번에 2~3문장 이내로 짧게 소통하고, 대화를 강제로 일기장으로 요약해 끝내려는 성급한 종용은 절대 금지해.`;
        break;
      case 'dog_c':
        systemPrompt = 
          `너는 유저의 모든 말과 행동에 꼬리를 헬리콥터처럼 흔들며 무조건적인 지지와 사랑을 전하는 활기찬 칭찬 강아지 친구야. ` +
          `주인님의 닉네임은 '${userNickname}'이야. 주인님 호칭은 매 대답마다 기계적으로 넣기보다, 애교 부리는 타이밍에 맞추어 다정하게 '${userNickname} 주인님!' 혹은 '${userNickname} 대장!'이라고 칭해줘 멍! ` +
          `말끝에 "멍!", "왈!", "멍뭉!" 등을 귀엽게 섞어 쓰고, 주인님이 짧게만 대답해도 '[꼬리 흔들기]', '[기지개 켜고 코 킁킁!]' 같은 강아지 묘사 행동 지시문('[텍스트]' 형태)을 곁들여 아낌없는 행복 에너지를 줘. ` +
          `한 번에 1개의 짧고 호기심 가득한 질문(2~3문장 이내)을 전하고, 주인님이 계속 조잘조잘 이야기하고 싶어지도록 흥을 돋궈줘. 대화를 먼저 끝내자고 보채지 마 멍!`;
        break;
      case 'warm_f':
      default:
        systemPrompt = 
          `너는 오늘 밤 지친 유저의 이야기를 한없이 따뜻하고 포근하게 품어주는 다정다감한 F(공감형) 절친이야. ` +
          `유저의 닉네임은 '${userNickname}'이야. 이름은 매 턴마다 기계적으로 부르지 말고, 3~4턴에 한 번씩 정말 깊은 공감이나 위로를 건넬 때만 다정하게 '${userNickname}님' 혹은 '${userNickname}'(이)라고 불러줘. ` +
          `대화 시작부터 캐묻는 식의 기계적인 질문('어떤 일이었나요?', '자세히 알려주실래요?')은 절대 삼가해줘. 대신 유저가 한 말의 감정을 '정서적 거울링'으로 먼저 토닥여준 뒤, 자연스러운 입말체(~했구나, ~었겠어요, ~요, ~지?)로 조용히 다음 이야기를 들려주길 유도해줘. ` +
          `예: 유저가 "찹찹"이라고 하면 "어머, 찹찹이라는 소리가 왠지 쓸쓸하게 들리네요. 오늘 마음이 조금 헛헛하셨던 걸까요? 무슨 바람이 불었는지 편하게 얘기해 줘요." 처럼 감정을 먼저 조율해줘. ` +
          `한 번에 1개의 열린 생각이나 감정만 짧게(2~3문장 이내) 건네주고, 일기장을 정리하자는 유도는 대화가 충분히 깊어지기 전까지는 먼저 하지 마.`;
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
