'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Volume2, Sparkles, ArrowLeft, MoreVertical, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  created_at: string;
}

/**
 * Haru Talk Dialogue Space.
 * 
 * WHY: Provides the messaging room. Handles loading past context,
 * recording dynamic voice payloads (MediaRecorder web buffers) to proxy Whisper STT,
 * streaming synthesized audio outputs via OpenAI TTS proxy, and tracking
 * turn counts to suggest summaries organically.
 */
export default function ChatPage() {
  const { id: sessionId } = useParams() as { id: string };
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [persona, setPersona] = useState<'warm_f' | 'rational_t' | 'dog_c'>('warm_f');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<string | null>(null);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [isMock, setIsMock] = useState(false);
  const [token, setToken] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const savedPersona = localStorage.getItem('haru_talk_persona') as 'warm_f' | 'rational_t' | 'dog_c' || 'warm_f';
    setPersona(savedPersona);

    // Prioritize loading active real Supabase token configurations
    async function resolveActiveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !sessionId.startsWith('mock-')) {
          setIsMock(false);
          loadRealHistory();
          return;
        }
      } catch (err) {
        logger.error('Failed checking active Supabase session on chat startup', err);
      }

      // Default mock fallback
      setIsMock(true);
      loadMockHistory(savedPersona);
      logger.info('Mock mode initialized for dialogue room.');
    }

    resolveActiveSession();
  }, [sessionId]);

  useEffect(() => {
    // Automatically auto-scroll chat window when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  /**
   * Restores simulated mock message thread from client cache.
   */
  const loadMockHistory = (selectedPersona: string) => {
    const mockMsgs = JSON.parse(localStorage.getItem(`haru_talk_mock_msgs_${sessionId}`) || '[]');
    if (mockMsgs.length === 0) {
      // First greeting message based on Persona
      let greeting = '';
      switch (selectedPersona) {
        case 'rational_t':
          greeting = '안녕. 오늘 하루는 어땠어? 오늘 있었던 주요 사건과 생각들을 차분히 정리해 보자. 피드백이나 나눌 고민이 있다면 얘기해줘.';
          break;
        case 'dog_c':
          greeting = '주인님 안녕! 왈왈! 꼬리 붕붕! 주인님 오늘 하루 어땠어멍? 멍뭉이한테 어서 다 털어놓으라멍! 귀 쫑긋!';
          break;
        case 'warm_f':
        default:
          greeting = '안녕! 오늘 하루도 참 고생 많았어. 힘든 일은 없었니? 네가 어떤 하루를 보냈는지 찬찬히 이야기해줘. 나는 들을 준비가 됐어.';
          break;
      }
      const initialGreeting: Message = {
        id: 'initial-greeting-uuid',
        sender: 'ai',
        content: greeting,
        created_at: new Date().toISOString(),
      };
      setMessages([initialGreeting]);
      localStorage.setItem(`haru_talk_mock_msgs_${sessionId}`, JSON.stringify([initialGreeting]));
    } else {
      setMessages(mockMsgs);
      // count user turns
      const userTurns = mockMsgs.filter((m: Message) => m.sender === 'user').length;
      setUserTurnCount(userTurns);
    }
  };

  /**
   * Retrieves live database message records and authenticates token.
   */
  const loadRealHistory = async () => {
    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession?.user) {
        window.location.href = '/';
        return;
      }
      setToken(supabaseSession.access_token);

      // Fetch session data to get persona
      const { data: sessionData, error: sErr } = await supabase
        .from('chat_sessions')
        .select('persona')
        .eq('id', sessionId)
        .single();
      if (!sErr && sessionData) {
        setPersona(sessionData.persona as 'warm_f' | 'rational_t' | 'dog_c');
      }

      // Fetch message logs
      const { data: dbMessages, error: mErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;

      if (!dbMessages || dbMessages.length === 0) {
        // AI sends first greeting by invoking API
        setIsAiTyping(true);
        let firstMsg = '';
        switch (sessionData?.persona) {
          case 'rational_t':
            firstMsg = '오늘 하루도 끝이 났네. 이성적으로 하루를 회고해 볼 준비가 되었어? 무슨 일이든 자세히 공유해줘.';
            break;
          case 'dog_c':
            firstMsg = '주인님 기다렸다멍! 멍멍! 왈왈! 꼬리 살랑살랑~ 오늘 무슨 재밌는 일 있었어멍? 다 얘기해 달라멍!';
            break;
          case 'warm_f':
          default:
            firstMsg = '오늘 하루도 견뎌내느라 정말 애썼어. 지금은 모든 짐을 내려놓고 오늘 너의 감정과 소소한 일상들을 편하게 나눠줄래?';
            break;
        }

        // Save AI first greeting into db
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender: 'ai',
          content: firstMsg,
        });

        setMessages([{
          id: `ai-init-${Date.now()}`,
          sender: 'ai',
          content: firstMsg,
          created_at: new Date().toISOString(),
        }]);
        setIsAiTyping(false);
      } else {
        setMessages(dbMessages.map((m: any) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          created_at: m.created_at,
        })));
        setUserTurnCount(dbMessages.filter((m: any) => m.sender === 'user').length);
      }

    } catch (err) {
      logger.error('Failed to load chat history from database', err);
      alert('데이터베이스 연결 실패. 다시 로그인해 주세요.');
      window.location.href = '/';
    }
  };

  /**
   * dispatches a user message to either Mock storage or Real backend.
   */
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    setInputText('');
    const userMsgId = `user-msg-${Date.now()}`;
    const newUserMsg: Message = {
      id: userMsgId,
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const updatedMsgs = [...messages, newUserMsg];
    setMessages(updatedMsgs);
    setIsAiTyping(true);
    const nextTurnCount = userTurnCount + 1;
    setUserTurnCount(nextTurnCount);

    if (isMock) {
      // Mock flow
      localStorage.setItem(`haru_talk_mock_msgs_${sessionId}`, JSON.stringify(updatedMsgs));
      
      // Simulate AI thinking and replying
      setTimeout(() => {
        let response = '';
        if (nextTurnCount >= 5) {
          response = '우와, 오늘 정말 다양한 이야기를 많이 나누었네! 대화의 내용이 아주 알찬 것 같아. 이제 이 대화를 바탕으로 오늘의 일기를 정리해 볼까? 화면 상단의 "일기 작성하기" 버튼을 눌러줘!';
        } else {
          switch (persona) {
            case 'rational_t':
              response = `그 상황에 대해서 너가 느꼈던 감정보다는, 그 상황에서 배운 점이나 개선할 수 있는 행동은 무엇이었을까? 차분히 설명해줘. (현재 진행 턴: ${nextTurnCount}/5)`;
              break;
            case 'dog_c':
              response = `와아! 꼬리를 미친듯이 흔드는 중! 왈왈! 멍멍! 그랬단 말이야멍? 진짜 신기하다왈! 다음은 어떻게 됐어멍? (현재 진행 턴: ${nextTurnCount}/5)`;
              break;
            case 'warm_f':
            default:
              response = `오, 그랬구나... 마음이 꽤 복잡했을 것 같아. 그 당시 어떤 기분이 가장 크게 들었는지 나에게 얘기해 주겠니? 내가 토닥여 줄게. (현재 진행 턴: ${nextTurnCount}/5)`;
              break;
          }
        }

        const newAiMsg: Message = {
          id: `ai-msg-${Date.now()}`,
          sender: 'ai',
          content: response,
          created_at: new Date().toISOString(),
        };

        const finalMsgs = [...updatedMsgs, newAiMsg];
        setMessages(finalMsgs);
        localStorage.setItem(`haru_talk_mock_msgs_${sessionId}`, JSON.stringify(finalMsgs));
        setIsAiTyping(false);
      }, 1000);

      return;
    }

    try {
      // Real flow via API Route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          message: text,
          persona,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch AI reply');

      let replyText = data.reply;

      // Suggest diary automatically on turn 5
      if (nextTurnCount === 5) {
        replyText = replyText + '\n\n오늘 정말 유익한 대화를 많이 나눴어. 이쯤에서 나눈 이야기를 정리해 예쁜 밤의 일기장을 만들어 줄까? 언제든 상단의 "일기 생성하기" 단추를 누르면 돼!';
      }

      setMessages(prev => [...prev, {
        id: `ai-msg-${Date.now()}`,
        sender: 'ai',
        content: replyText,
        created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      logger.error('Failed to dispatch chat sequence', err);
      alert('AI가 졸고 있는 것 같습니다. 다시 메세지를 전송해 주세요.');
    } finally {
      setIsAiTyping(false);
    }
  };

  /**
   * Initializes browser audio recording triggers.
   */
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Premium Cross-Browser MediaRecorder Options Configuration
      // Apple devices/Safari strictly mandate 'audio/mp4', while Chrome/Firefox support 'audio/webm'
      let mediaOptions = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mediaOptions = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mediaOptions = { mimeType: 'audio/mp4' };
        }
      }

      const recorder = new MediaRecorder(stream, mediaOptions);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const currentMime = recorder.mimeType || 'audio/webm';
        const fileExt = currentMime.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: currentMime });
        
        await uploadAudioPayload(audioBlob, fileExt);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      logger.info('Browser audio recording session initialized.');
    } catch (err) {
      logger.error('Failed to trigger audio hardware', err);
      alert('마이크가 꺼져있거나 오디오 디바이스를 지원하지 않는 브라우저입니다.');
    }
  };

  /**
   * Halts active recording buffers.
   */
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Uploads recorded audio blobs to Whisper STT proxy and sends the transcription.
   */
  const uploadAudioPayload = async (blob: Blob, extension = 'webm') => {
    // If Mock, simulate voice text input immediately
    if (isMock) {
      setIsAiTyping(true);
      setTimeout(() => {
        const transcribedMocks = [
          '오늘 회사에서 진짜 힘든 일 있었는데 얘기 좀 들어봐.',
          '오늘 친구랑 맛있는 거 먹고 와서 너무 기분 좋아!',
          '그냥 조용히 나를 토닥여주는 노래 같은 하루였어.',
        ];
        const randomIndex = Math.floor(Math.random() * transcribedMocks.length);
        const randomText = transcribedMocks.at(randomIndex) || '';
        logger.info(`Simulated Whisper STT output: "${randomText}"`);
        handleSendMessage(randomText);
      }, 1000);
      return;
    }

    try {
      setIsAiTyping(true);
      const audioFormData = new FormData();
      audioFormData.append('file', blob, `recording.${extension}`);

      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: audioFormData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed STT Whisper transcript');

      if (data.text) {
        logger.info(`Whisper STT transcript successful: "${data.text}"`);
        handleSendMessage(data.text);
      } else {
        alert('음성이 뚜렷하게 들리지 않았어요. 조용한 방에서 다시 말씀해 주세요!');
        setIsAiTyping(false);
      }
    } catch (err) {
      logger.error('Failed to process Whisper upload stream', err);
      alert('오디오 음성 텍스트 변환 서버 연동에 실패했습니다.');
      setIsAiTyping(false);
    }
  };

  /**
   * Proxies text values to OpenAI TTS to stream natural voice outputs.
   */
  const triggerTextToSpeech = async (msgId: string, text: string) => {
    if (isTtsPlaying === msgId) {
      setIsTtsPlaying(null);
      return;
    }

    setIsTtsPlaying(msgId);

    // If Mock, use browser native speech synthesis (zero-cost offline fallback)
    if (isMock) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        utterance.onend = () => setIsTtsPlaying(null);
        window.speechSynthesis.speak(utterance);
      } else {
        logger.warn('Web speech synthesis not supported locally.');
        setIsTtsPlaying(null);
      }
      return;
    }

    try {
      let voiceCode = 'alloy'; // default warm_f voice
      if (persona === 'rational_t') voiceCode = 'onyx';
      if (persona === 'dog_c') voiceCode = 'nova';

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          voice: voiceCode,
        }),
      });

      if (!response.ok) throw new Error('Failed to download TTS stream');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsTtsPlaying(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play();

    } catch (err) {
      logger.error('TTS execution crashed', err);
      alert('음성 듣기 연동에 실패했습니다.');
      setIsTtsPlaying(null);
    }
  };

  /**
   * Routes the client to the loading summary processing screen.
   */
  const handleCompileDiary = () => {
    window.location.href = `/diary/${sessionId}`;
  };

  return (
    <main className="flex-1 flex flex-col max-h-screen h-screen relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041a]">
      {/* Wave Ambience glow */}
      <div className="absolute top-0 inset-x-0 h-[100px] bg-purple-500/5 blur-[50px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="glass-panel w-full px-4 py-3 flex justify-between items-center z-10 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.href = '/setup'}
            className="p-1.5 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>하루톡 회고방</span>
              <span className="text-[10px] text-purple-300 font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                {persona === 'warm_f' ? '따뜻한 위로 F' : persona === 'rational_t' ? '명쾌한 조언 T' : '경청 멍멍이'}
              </span>
            </h1>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {isMock ? '체험용 로컬 세션 진행 중' : '실시간 보안 암호화 통신'}
            </p>
          </div>
        </div>

        {/* Generate Diary Trigger FAB */}
        <button
          id="diary-create-btn"
          onClick={handleCompileDiary}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-[11px] font-bold shadow-[0_4px_15px_rgba(167,139,250,0.25)] transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>일기 작성하기 ({userTurnCount}/5)</span>
        </button>
      </header>

      {/* MESSAGES LOG VIEW */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 select-text">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isAi = msg.sender === 'ai';
            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`flex gap-3 items-end ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {/* AI Avatar */}
                {isAi && (
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                    persona === 'warm_f' ? 'bg-purple-950/40 text-purple-300 border border-purple-800/30' :
                    persona === 'rational_t' ? 'bg-blue-950/40 text-blue-300 border border-blue-800/30' :
                    'bg-rose-950/40 text-rose-300 border border-rose-800/30'
                  }`}>
                    {persona === 'warm_f' ? 'F' : persona === 'rational_t' ? 'T' : '🐾'}
                  </div>
                )}

                {/* Message Bubble wrapper */}
                <div className={`flex flex-col max-w-[70%] gap-1.5 ${isAi ? 'items-start' : 'items-end'}`}>
                  
                  {/* Bubble body card */}
                  <div className={`rounded-2xl p-4 text-xs font-medium leading-relaxed ${
                    isAi
                      ? 'bg-slate-900/60 border border-slate-800/80 text-white rounded-tl-sm'
                      : 'bg-purple-600/90 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(147,51,234,0.15)]'
                  }`}>
                    {msg.content.split('\n').map((line, lIdx) => (
                      <p key={lIdx} className={lIdx > 0 ? 'mt-1.5' : ''}>{line}</p>
                    ))}
                  </div>

                  {/* Bubble Sub-action: Play Voice (TTS) only for AI messages */}
                  {isAi && (
                    <button
                      id={`tts-play-${msg.id}`}
                      onClick={() => triggerTextToSpeech(msg.id, msg.content)}
                      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                        isTtsPlaying === msg.id
                          ? 'text-purple-300 border-purple-500/30 bg-purple-500/10'
                          : 'text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <Volume2 className={`w-3 h-3 ${isTtsPlaying === msg.id ? 'animate-pulse' : ''}`} />
                      <span>{isTtsPlaying === msg.id ? '말하는 중...' : '음성 듣기'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* AI Typing Indicator */}
        {isAiTyping && (
          <div className="flex gap-3 items-center justify-start">
            <div className="w-8 h-8 rounded-xl bg-slate-900/50 border border-slate-800/30 flex items-center justify-center font-bold text-xs text-slate-400">
              ••
            </div>
            <div className="rounded-2xl p-3 bg-slate-900/40 border border-slate-900 text-slate-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full loading-dot" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full loading-dot" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full loading-dot" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* DYNAMIC FOOTER CONTROLLER */}
      <footer className="glass-panel w-full p-4 z-10 flex flex-col gap-3 pb-8">
        
        {/* VOICE RECORDING OVERLAY RIPPLE INDICATOR */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center justify-center bg-purple-950/20 border border-purple-500/15 rounded-2xl py-4"
            >
              <p className="text-[10px] text-purple-300 font-bold tracking-wider mb-3 uppercase animate-pulse">
                실시간 오디오 마이크 인식 중...
              </p>
              
              {/* Wave ripples */}
              <div className="flex items-end gap-1 h-8 mb-4">
                <div className="w-1 h-3 bg-purple-400 rounded-full voice-wave-bar" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-7 bg-purple-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.3s' }} />
                <div className="w-1 h-5 bg-blue-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.5s' }} />
                <div className="w-1 h-8 bg-purple-400 rounded-full voice-wave-bar" style={{ animationDelay: '0.2s' }} />
                <div className="w-1 h-4 bg-indigo-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.4s' }} />
              </div>

              <button
                id="voice-stop-btn"
                onClick={stopAudioRecording}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-[0_4px_15px_rgba(220,38,38,0.25)] active:scale-[0.98]"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>녹음 완료 및 전송</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INPUT FORM TOOLBAR */}
        <div className="flex items-center gap-3">
          
          {/* Audio recording trigger */}
          {!isRecording && (
            <button
              id="voice-start-btn"
              onClick={startAudioRecording}
              disabled={isAiTyping}
              className="w-11 h-11 rounded-xl bg-slate-900/80 hover:bg-purple-950/20 hover:text-purple-300 border border-slate-800 text-slate-400 flex items-center justify-center transition-all shrink-0 active:scale-[0.95] disabled:opacity-50"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}

          {/* Text Input */}
          <input
            id="chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={isAiTyping ? 'AI가 답변을 생각하는 중입니다...' : '친구와 대화하듯 편하게 적어주세요...'}
            disabled={isAiTyping || isRecording}
            className="flex-1 h-11 rounded-xl px-4 text-xs glass-input font-medium disabled:opacity-50"
          />

          {/* Send text button */}
          <button
            id="chat-send-btn"
            onClick={() => handleSendMessage()}
            disabled={isAiTyping || isRecording || !inputText.trim()}
            className="w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-900/60 text-white flex items-center justify-center transition-all shrink-0 active:scale-[0.95] shadow-[0_4px_15px_rgba(147,51,234,0.2)] disabled:shadow-none disabled:opacity-50"
          >
            <Send className="w-4 h-4 fill-current" />
          </button>
        </div>
      </footer>
    </main>
  );
}
