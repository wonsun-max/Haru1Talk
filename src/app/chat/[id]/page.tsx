'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Volume2, Sparkles, ArrowLeft } from 'lucide-react';
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
 * WHY: Provides a production-only communication room interface. Connects users strictly
 * to the secure backend proxies for OpenAI completions, Whisper speech transcriptions, and
 * OpenAI TTS streaming voices, backed by database session token verification.
 */
export default function ChatPage() {
  const { id: sessionId } = useParams() as { id: string };
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [persona, setPersona] = useState<'warm_f' | 'rational_t' | 'dog_c'>('warm_f');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<string | null>(null);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [token, setToken] = useState<string>('');

  // Live Call Mode states
  const [isLiveCallMode, setIsLiveCallMode] = useState(false);
  const [liveCallState, setLiveCallState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  // Microphone error guide modal state
  const [isMicModalOpen, setIsMicModalOpen] = useState(false);
  const [micBrowserType, setMicBrowserType] = useState<'safari' | 'chrome' | 'kakao' | 'other'>('other');

  // Synchronized refs for VAD audio closure callback tracking
  const isLiveCallModeRef = useRef(false);
  const liveCallStateRef = useRef<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const isRecordingRef = useRef(false);
  
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const vadAnimationIdRef = useRef<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Synchronize states to refs
  useEffect(() => {
    isLiveCallModeRef.current = isLiveCallMode;
  }, [isLiveCallMode]);

  useEffect(() => {
    liveCallStateRef.current = liveCallState;
  }, [liveCallState]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  /**
   * Destroys active audio streams, MediaRecorder locks, and silence triggers.
   */
  const cleanupAudioStream = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch (err) {
        // ignore
      }
      activeAudioRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
    setIsRecording(false);
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (err) {
        // ignore
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
  };

  // Clean up all streams on unmount
  useEffect(() => {
    return () => {
      cleanupAudioStream();
    };
  }, []);

  useEffect(() => {
    const savedPersona = localStorage.getItem('haru_talk_persona') as 'warm_f' | 'rational_t' | 'dog_c' || 'warm_f';
    setPersona(savedPersona);

    // Enforce active real Supabase token checks on mount
    async function checkAuthSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          loadRealHistory();
        } else {
          logger.warn('Unauthenticated access attempt to dialogue room. Redirecting to landing.');
          router.push('/');
        }
      } catch (err) {
        logger.error('Failed to verify active authentication session on chat startup', err);
        router.push('/');
      }
    }
    checkAuthSession();
  }, [sessionId]);

  useEffect(() => {
    // If URL specifies mode=live, automatically activate premium Hands-free voice call mode!
    if (typeof window !== 'undefined' && window.location.search.includes('mode=live')) {
      setIsLiveCallMode(true);
      setLiveCallState('listening');
      const timer = setTimeout(() => {
        startAudioRecording();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Automatically auto-scroll chat window when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  /**
   * Retrieves live database message records and authenticates token.
   * 
   * WHY: Renders authentic message history streams saved in the database for the active session.
   */
  const loadRealHistory = async () => {
    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession?.user) {
        router.push('/');
        return;
      }
      setToken(supabaseSession.access_token);

      // Fetch session details to load the corresponding AI persona
      const { data: sessionData, error: sErr } = await supabase
        .from('chat_sessions')
        .select('persona')
        .eq('id', sessionId)
        .single();
      if (!sErr && sessionData) {
        setPersona(sessionData.persona as 'warm_f' | 'rational_t' | 'dog_c');
      }

      // Fetch past chat logs ordered by creation timestamps
      const { data: dbMessages, error: mErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;

      if (!dbMessages || dbMessages.length === 0) {
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

        // Write AI initial greeting to database
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
        interface DbMessage { id: string; sender: 'user' | 'ai'; content: string; created_at: string; }
        setMessages(dbMessages.map((m: DbMessage) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          created_at: m.created_at,
        })));
        setUserTurnCount(dbMessages.filter((m: DbMessage) => m.sender === 'user').length);
      }

    } catch (err) {
      logger.error('Failed to load chat history from database', err);
      alert('데이터베이스 연결 실패. 다시 로그인해 주세요.');
      router.push('/');
    }
  };

  /**
   * Dispatches a user message to the live backend chat route.
   * 
   * WHY: Proxies prompts to the secure OpenAI completion endpoint and preserves history logs.
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

    try {
      // Real API proxy dispatch
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

      // Suggest diary compilation at exactly 5 dialogue turns
      if (nextTurnCount === 5) {
        replyText = replyText + '\n\n오늘 정말 많은 이야기를 나눴어. 이쯤에서 나눈 이야기를 정리해 예쁜 밤의 일기장을 만들어 줄까? 언제든 상단의 "일기 작성하기" 단추를 누르면 돼!';
      }

      setMessages(prev => [...prev, {
        id: `ai-msg-${Date.now()}`,
        sender: 'ai',
        content: replyText,
        created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      logger.error('Failed to dispatch chat sequence to server APIs', err);
      alert('AI가 졸고 있는 것 같습니다. 다시 메세지를 전송해 주세요.');
    } finally {
      setIsAiTyping(false);
    }
  };

  /**
   * Toggles between standard Text Chat and Live Voice Call modes.
   */
  const handleToggleLiveCallMode = () => {
    if (isLiveCallMode) {
      setIsLiveCallMode(false);
      setLiveCallState('idle');
      cleanupAudioStream();
    } else {
      setIsLiveCallMode(true);
      setLiveCallState('idle');
    }
  };

  /**
   * Initializes browser audio recording triggers.
   * 
   * WHY: Captures microphone audio inputs in optimal browser capabilities (webm / mp4 fallback)
   * and mounts the live VAD (Voice Activity Detection) analyser loop when in Voice Call Mode.
   */
  const startAudioRecording = async () => {
    try {
      cleanupAudioStream(); // Safety clear before initiating a new track
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Premium Cross-Browser MediaRecorder Options Configuration
      let mediaOptions: { audioBitsPerSecond: number; mimeType?: string } = {
        audioBitsPerSecond: 64000, // 64kbps is extremely clear for voice but 10x smaller in network footprint
      };
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mediaOptions.mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mediaOptions.mimeType = 'audio/mp4';
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
        
        if (isLiveCallModeRef.current) {
          setLiveCallState('thinking');
          await uploadLiveVoicePayload(audioBlob, fileExt);
        } else {
          await uploadAudioPayload(audioBlob, fileExt);
        }
        
        // Release hardware device tracks immediately
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      if (isLiveCallModeRef.current) {
        setLiveCallState('listening');
        // Web Audio VAD Volume Threshold Analyzer Setup
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          lastSoundTimeRef.current = Date.now();

          const checkSilence = () => {
            if (!analyserRef.current || !isRecordingRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const averageVolume = sum / bufferLength;

            // Volume threshold 8 marks speaking voice
            if (averageVolume > 8) {
              lastSoundTimeRef.current = Date.now();
            } else {
              const silenceDuration = Date.now() - lastSoundTimeRef.current;
              // 1.2s silence auto-triggers submission
              if (silenceDuration > 1200) {
                logger.info('VAD Silence detected. Transcribing voice call.');
                stopAudioRecording();
                return;
              }
            }

            if (isRecordingRef.current) {
              vadAnimationIdRef.current = requestAnimationFrame(checkSilence);
            }
          };

          vadAnimationIdRef.current = requestAnimationFrame(checkSilence);
        }
      }

      logger.info('Browser audio recording session initialized.');
    } catch (err) {
      logger.error('Failed to trigger audio hardware', err);
      // Detect user agent for customized browser mic guides
      const ua = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
      if (ua.includes('kakaotalk')) {
        setMicBrowserType('kakao');
      } else if (ua.includes('chrome') || ua.includes('crios')) {
        setMicBrowserType('chrome');
      } else if (ua.includes('safari') && !ua.includes('chrome')) {
        setMicBrowserType('safari');
      } else {
        setMicBrowserType('other');
      }
      setIsMicModalOpen(true);

      if (isLiveCallModeRef.current) {
        setLiveCallState('idle');
      }
    }
  };

  /**
   * Halts active recording buffers.
   * 
   * WHY: Triggers the stop callback of the MediaRecorder to process the completed blob stream.
   */
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Uploads recorded audio blobs to Whisper STT proxy and sends the transcription.
   * 
   * WHY: Converts voice recording data into text securely via Whisper-1 on the server.
   */
  const uploadAudioPayload = async (blob: Blob, extension = 'webm') => {
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
   * Voice Call specific Whisper STT dispatcher.
   */
  const uploadLiveVoicePayload = async (blob: Blob, extension = 'webm') => {
    try {
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

      if (data.text && data.text.trim()) {
        logger.info(`Whisper Voice Call STT transcription successful: "${data.text}"`);
        await handleSendLiveMessage(data.text);
      } else {
        logger.info('No transcription content captured, returning to listening state.');
        setLiveCallState('listening');
        startAudioRecording();
      }
    } catch (err) {
      logger.error('Failed to process Whisper voice call upload stream', err);
      setLiveCallState('listening');
      startAudioRecording();
    }
  };

  /**
   * Voice Call specific AI conversation dispatcher.
   */
  const handleSendLiveMessage = async (text: string) => {
    const userMsgId = `user-msg-${Date.now()}`;
    const newUserMsg: Message = {
      id: userMsgId,
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setLiveCallState('thinking');
    setIsAiTyping(true);
    const nextTurnCount = userTurnCount + 1;
    setUserTurnCount(nextTurnCount);

    try {
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
          isLiveCall: true, // Optimizes the prompt to strictly yield short replies
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch AI reply');

      let replyText = data.reply;

      if (nextTurnCount === 5) {
        replyText = replyText + '\n\n오늘 정말 많은 이야기를 나눴어. 이쯤에서 나눈 이야기를 정리해 예쁜 밤의 일기장을 만들어 줄까? 언제든 상단의 "일기 작성하기" 단추를 누르면 돼!';
      }

      const newAiMsgId = `ai-msg-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: newAiMsgId,
        sender: 'ai',
        content: replyText,
        created_at: new Date().toISOString(),
      }]);
      setIsAiTyping(false);

      await triggerLiveTextToSpeech(newAiMsgId, replyText);

    } catch (err) {
      logger.error('Failed to dispatch live call chat sequence to server APIs', err);
      setLiveCallState('listening');
      setIsAiTyping(false);
      startAudioRecording();
    }
  };

  /**
   * Voice Call specific TTS synthesis and playback loop manager.
   */
  const triggerLiveTextToSpeech = async (msgId: string, text: string) => {
    try {
      let voiceCode = 'alloy';
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
      
      activeAudioRef.current = audio;
      setLiveCallState('speaking');

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioRef.current = null;
        
        // Auto-restart loop if still in Live Call Mode
        if (isLiveCallModeRef.current) {
          logger.info('Live TTS playback completed. Automatically re-arming microphone.');
          setLiveCallState('listening');
          startAudioRecording();
        } else {
          setLiveCallState('idle');
        }
      };

      await audio.play();

    } catch (err) {
      logger.error('Live call TTS execution crashed', err);
      if (isLiveCallModeRef.current) {
        setLiveCallState('listening');
        startAudioRecording();
      } else {
        setLiveCallState('idle');
      }
    }
  };

  /**
   * Proxies text values to OpenAI TTS to stream natural voice outputs.
   * 
   * WHY: Requests natural voice speech stream binaries dynamically matching the persona.
   */
  const triggerTextToSpeech = async (msgId: string, text: string) => {
    if (isTtsPlaying === msgId) {
      setIsTtsPlaying(null);
      return;
    }

    setIsTtsPlaying(msgId);

    try {
      let voiceCode = 'alloy';
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
   * Navigates user to the diary compilation screen after validating minimum dialogue turns.
   * 
   * WHY: Prevents users from generating empty/fictional summaries if no conversation has taken place.
   */
  const handleCompileDiary = () => {
    if (userTurnCount < 1) {
      alert('최소 1회 이상 대화를 전송하셔야 오늘의 일기장을 완성할 수 있습니다! 아래 입력창에 오늘 하루 있었던 소소한 이야기나 속마음을 들려주세요.');
      return;
    }
    router.push(`/diary/${sessionId}`);
  };

  return (
    <main className="flex-1 flex flex-col max-h-screen h-screen relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041a]">
      {/* Wave Ambience glow */}
      <div className="absolute top-0 inset-x-0 h-[100px] bg-purple-500/5 blur-[50px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="glass-panel w-full px-4 py-3 flex justify-between items-center z-10 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-1.5 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              실시간 보안 암호화 통신
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Voice Call Toggle FAB */}
          <button
            id="live-call-toggle-btn"
            onClick={handleToggleLiveCallMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all active:scale-[0.98] cursor-pointer shadow-[0_2px_10px_rgba(167,139,250,0.1)] border ${
              isLiveCallMode
                ? 'bg-red-950/40 text-red-300 border-red-500/20 hover:bg-red-900/50 shadow-[0_2px_10px_rgba(239,68,68,0.15)]'
                : 'bg-purple-950/40 text-purple-300 border-purple-500/20 hover:bg-purple-900/50'
            }`}
          >
            <Mic className={`w-3.5 h-3.5 ${isLiveCallMode ? 'animate-pulse text-red-400' : 'text-purple-400'}`} />
            <span>{isLiveCallMode ? '채팅 모드로 전환' : '실시간 음성 통화'}</span>
          </button>

          {/* Generate Diary Trigger FAB */}
          <button
            id="diary-create-btn"
            onClick={handleCompileDiary}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-[11px] font-bold shadow-[0_4px_15px_rgba(167,139,250,0.25)] transition-all active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>일기 작성하기 ({userTurnCount}/5)</span>
          </button>
        </div>
      </header>

      {/* CLASSIC CHAT MESSAGES LOG VIEW */}
      {!isLiveCallMode && (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 select-text">
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => {
              const isAi = msg.sender === 'ai';
              return (
                <motion.div
                  key={msg.id || index}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className={`flex gap-3 items-end ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {/* AI Avatar */}
                  {isAi && (
                    <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm shadow-md transition-all duration-300 border ${
                      persona === 'warm_f' ? 'bg-gradient-to-tr from-purple-500/20 to-indigo-600/20 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]' :
                      persona === 'rational_t' ? 'bg-gradient-to-tr from-blue-500/20 to-cyan-600/20 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]' :
                      'bg-gradient-to-tr from-rose-500/20 to-orange-500/20 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                    }`}>
                      {persona === 'warm_f' ? '🌸' : persona === 'rational_t' ? '⚡' : '🐶'}
                    </div>
                  )}

                  {/* Message Bubble wrapper */}
                  <div className={`flex flex-col max-w-[70%] gap-2 ${isAi ? 'items-start' : 'items-end'}`}>
                    
                    {/* Bubble body card */}
                    {isAi ? (
                      <div className={`glass-panel-heavy rounded-2xl px-5 py-3.5 text-xs font-medium leading-relaxed shadow-xl border-l-4 rounded-tl-none ${
                        persona === 'warm_f' ? 'border-l-purple-500/60 border-t-white/5 border-r-white/5 border-b-white/5 bg-slate-950/40 text-purple-50 shadow-[0_8px_32px_rgba(167,139,250,0.05)]' :
                        persona === 'rational_t' ? 'border-l-blue-500/60 border-t-white/5 border-r-white/5 border-b-white/5 bg-slate-950/40 text-blue-50 shadow-[0_8px_32px_rgba(56,189,248,0.05)]' :
                        'border-l-rose-500/60 border-t-white/5 border-r-white/5 border-b-white/5 bg-slate-950/40 text-rose-50 shadow-[0_8px_32px_rgba(244,63,94,0.05)]'
                      }`}>
                        {msg.content.split('\n').map((line, lIdx) => (
                          <p key={lIdx} className={lIdx > 0 ? 'mt-1.5' : ''}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-purple-500 via-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-none px-5 py-3.5 text-xs font-semibold leading-relaxed shadow-[0_8px_30px_rgba(167,139,250,0.2)] border border-purple-400/20">
                        {msg.content.split('\n').map((line, lIdx) => (
                          <p key={lIdx} className={lIdx > 0 ? 'mt-1.5' : ''}>{line}</p>
                        ))}
                      </div>
                    )}

                    {/* Bubble Sub-action: Play Voice (TTS) only for AI messages */}
                    {isAi && (
                      <button
                        id={`tts-play-${msg.id}`}
                        onClick={() => triggerTextToSpeech(msg.id, msg.content)}
                        className={`flex items-center gap-1.5 text-[9px] font-bold px-3 py-1.5 rounded-full border transition-all duration-300 cursor-pointer shadow-sm active:scale-[0.98] ${
                          isTtsPlaying === msg.id
                            ? 'text-purple-200 border-purple-500/40 bg-purple-500/20 shadow-[0_0_10px_rgba(167,139,250,0.2)]'
                            : 'text-slate-400 border-white/5 bg-slate-950/40 hover:text-white hover:border-purple-500/20'
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isTtsPlaying === msg.id ? 'animate-pulse text-purple-300' : ''}`} />
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
              <div className={`w-9 h-9 rounded-full bg-slate-900/50 border border-white/5 flex items-center justify-center text-sm shadow-[0_0_8px_rgba(0,0,0,0.2)]`}>
                {persona === 'warm_f' ? '🌸' : persona === 'rational_t' ? '⚡' : '🐶'}
              </div>
              <div className="glass-panel-heavy rounded-2xl px-4 py-3 border border-white/5 text-slate-300 flex items-center gap-1 rounded-tl-none shadow-lg">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full loading-dot animate-bounce" />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full loading-dot animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full loading-dot animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      {/* CLASSIC CHAT FOOTER CONTROLLER */}
      {!isLiveCallMode && (
        <footer className="glass-panel w-full p-4 z-10 flex flex-col gap-3 pb-8 border-t border-white/5 shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
          
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
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-[0_4px_15px_rgba(220,38,38,0.25)] active:scale-[0.98] cursor-pointer"
                >
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
                className="w-11 h-11 rounded-xl bg-slate-900/60 hover:bg-purple-950/20 hover:text-purple-300 border border-white/5 text-slate-400 flex items-center justify-center transition-all shrink-0 active:scale-[0.95] disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Mic className="w-5 h-5 text-purple-300" />
              </button>
            )}

            {/* Premium Integrated Text Input Box */}
            <div className="flex-1 h-11 rounded-xl px-4 flex items-center border border-white/10 bg-slate-950/40 focus-within:border-purple-400/50 focus-within:ring-1 focus-within:ring-purple-400/50 transition-all duration-300 shadow-inner">
              <input
                id="chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder={isAiTyping ? 'AI가 답변을 생각하고 있습니다...' : '친구와 나누듯 고요하고 다정하게 대화해봐요...'}
                disabled={isAiTyping || isRecording}
                className="flex-1 bg-transparent border-none text-white text-xs font-semibold placeholder-slate-500 outline-none focus:ring-0 disabled:opacity-50"
              />
            </div>

            {/* Send text button */}
            <button
              id="chat-send-btn"
              onClick={() => handleSendMessage()}
              disabled={isAiTyping || isRecording || !inputText.trim()}
              className="w-11 h-11 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:from-slate-900/60 disabled:to-slate-900/60 disabled:bg-none text-white flex items-center justify-center transition-all shrink-0 active:scale-[0.95] shadow-[0_4px_15px_rgba(147,51,234,0.25)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.4)] disabled:shadow-none disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </div>
        </footer>
      )}

      {/* LIVE VOICE CALL INTERFACE OVERLAY */}
      {isLiveCallMode && (
        <div className="absolute inset-x-0 bottom-0 top-[60px] z-30 flex flex-col bg-gradient-to-b from-[#02020a] to-[#04041b] overflow-hidden select-none">
          {/* Subtle background space radial gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.02)_0%,transparent_70%)] pointer-events-none" />

          {/* Interactive Visualizer Sphere section */}
          <div className="flex-1 flex flex-col items-center justify-center relative p-6">
            
            {/* Ambient Background Glow matching the active state */}
            <div className={`absolute w-[280px] h-[280px] rounded-full blur-[110px] transition-all duration-1000 opacity-25 pointer-events-none ${
              liveCallState === 'listening' ? 'bg-emerald-500/20' :
              liveCallState === 'thinking' ? 'bg-purple-500/20' :
              liveCallState === 'speaking' ? 'bg-blue-500/20' :
              'bg-purple-900/10'
            }`} />

            {/* Glowing Pulsating Orb Container */}
            <motion.div
              onClick={() => {
                if (liveCallState === 'idle') {
                  setLiveCallState('listening');
                  startAudioRecording();
                } else if (liveCallState === 'listening') {
                  setLiveCallState('thinking');
                  stopAudioRecording();
                } else if (liveCallState === 'speaking') {
                  cleanupAudioStream();
                  setLiveCallState('listening');
                  startAudioRecording();
                }
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="relative w-44 h-44 rounded-full flex items-center justify-center cursor-pointer z-10"
            >
              {/* Outer pulsating wave rings */}
              <AnimatePresence>
                {liveCallState === 'listening' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
                  />
                )}
                {liveCallState === 'speaking' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                  />
                )}
                {liveCallState === 'thinking' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                    className="absolute -inset-2 rounded-full border border-dashed border-purple-500/20"
                  />
                )}
              </AnimatePresence>

              {/* Main Sphere Body */}
              <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700 shadow-2xl ${
                liveCallState === 'listening' ? 'bg-gradient-to-tr from-emerald-950/40 to-teal-800/20 border border-emerald-500/40 shadow-emerald-950/30 animate-pulse' :
                liveCallState === 'thinking' ? 'bg-gradient-to-tr from-purple-950/40 to-indigo-800/20 border border-purple-500/40 shadow-purple-950/30' :
                liveCallState === 'speaking' ? 'bg-gradient-to-tr from-blue-950/40 to-indigo-800/20 border border-blue-500/40 shadow-blue-950/30' :
                'bg-gradient-to-tr from-slate-900/60 to-purple-950/20 border border-slate-800/80 shadow-black'
              }`}>
                {/* Character avatar indicator */}
                <span className="text-4xl select-none mb-1 animate-bounce" style={{ animationDuration: '3.5s' }}>
                  {persona === 'warm_f' ? '🌸' : persona === 'rational_t' ? '⚡' : '🐶'}
                </span>
                
                <span className="text-[10px] font-bold text-slate-300 tracking-widest mt-1">
                  {persona === 'warm_f' ? 'HARU F' : persona === 'rational_t' ? 'HARU T' : 'DOGGY'}
                </span>
              </div>
            </motion.div>

            {/* Speaking equalizer bars */}
            {liveCallState === 'speaking' && (
              <div className="flex gap-1.5 h-6 mt-8 items-end z-10">
                <div className="w-1 h-2 bg-blue-400 rounded-full voice-wave-bar" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-5 bg-blue-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.3s' }} />
                <div className="w-1 h-3 bg-indigo-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.5s' }} />
                <div className="w-1 h-6 bg-blue-400 rounded-full voice-wave-bar" style={{ animationDelay: '0.2s' }} />
                <div className="w-1 h-4 bg-purple-300 rounded-full voice-wave-bar" style={{ animationDelay: '0.4s' }} />
              </div>
            )}

            {/* Listening dots */}
            {liveCallState === 'listening' && (
              <div className="flex gap-1.5 h-4 mt-8 items-center z-10">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
              </div>
            )}

            {/* Descriptive Status cues */}
            <div className="text-center mt-8 z-10 max-w-xs px-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                {liveCallState === 'listening' ? '경청하는 중...' :
                 liveCallState === 'thinking' ? '이야기를 듣고 생각하는 중...' :
                 liveCallState === 'speaking' ? '친구가 말하는 중...' :
                 '통화 준비 완료'}
              </h2>
              
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium">
                {liveCallState === 'listening' ? '오늘 있었던 소소한 일이나 감정을 편하게 말씀해 주세요. 말하기를 마치면 침묵하거나 아래 단추를 누르세요.' :
                 liveCallState === 'thinking' ? '음성 메세지를 전송받아 답변을 구성하고 있습니다...' :
                 liveCallState === 'speaking' ? '친구의 목소리에 귀를 기울여 보세요. 화면 구체를 탭하면 이야기를 중단하고 즉시 말을 시작합니다.' :
                 '아래 "통화 시작" 단추를 누르거나 구체를 탭하여 대화를 시작해 보세요.'}
              </p>
            </div>
          </div>

          {/* Active call controller bottom deck */}
          <footer className="w-full px-6 pb-12 flex flex-col gap-4 items-center z-10">
            
            {/* Primary Action Buttons */}
            <div className="flex gap-4 w-full max-w-sm justify-center items-center">
              
              {/* Start/Finish speak toggle */}
              {liveCallState === 'idle' ? (
                <button
                  id="live-start-call-btn"
                  onClick={() => {
                    setLiveCallState('listening');
                    startAudioRecording();
                  }}
                  className="flex-1 h-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs shadow-[0_4px_15px_rgba(167,139,250,0.25)] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>통화 시작</span>
                </button>
              ) : liveCallState === 'listening' ? (
                <button
                  id="live-submit-speak-btn"
                  onClick={() => {
                    setLiveCallState('thinking');
                    stopAudioRecording();
                  }}
                  className="flex-1 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-[0_4px_15px_rgba(16,185,129,0.25)] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>말하기 완료 (즉시 전송)</span>
                </button>
              ) : (
                <div className="flex-1 h-12 flex items-center justify-center bg-slate-900/60 border border-slate-800 text-slate-500 font-bold text-xs rounded-full">
                  <span>{liveCallState === 'thinking' ? '통신 분석 대기 중' : '친구의 답변 청취 중'}</span>
                </div>
              )}

              {/* Hang up controller */}
              <button
                id="live-hangup-btn"
                onClick={handleToggleLiveCallMode}
                className="px-6 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(220,38,38,0.25)] cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>종료</span>
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              실시간 암호화 인장 통화 보안 채널
            </p>
          </footer>
        </div>
      )}

      {/* Premium Glassmorphic Microphone Permission Modal */}
      <AnimatePresence>
        {isMicModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-sm w-full border border-red-500/20 shadow-2xl relative overflow-hidden flex flex-col"
            >
              {/* Glow light background decoration */}
              <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-red-500/10 blur-xl pointer-events-none" />
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-red-400" />
                </div>
                
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  마이크 접근 권한이 필요해요
                </h3>
                
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  하루톡의 AI 친구와 음성으로 따뜻하게 교감하려면 마이크 사용 허가가 필수적입니다.
                </p>

                {/* Localized Browser-Specific Help Guides */}
                <div className="w-full mt-5 p-4 rounded-xl bg-slate-950/40 border border-slate-900 text-left text-xs leading-relaxed">
                  <p className="text-[11px] font-bold text-indigo-300 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>사용 중인 브라우저 해결 방법</span>
                  </p>
                  
                  {micBrowserType === 'kakao' ? (
                    <ol className="list-decimal pl-4 space-y-1.5 text-slate-300 text-[11px]">
                      <li>카카오톡 대화창 오른쪽 아래 <strong>'더보기(···)'</strong> 탭을 클릭합니다.</li>
                      <li>오른쪽 상단 <strong>설정 아이콘</strong>을 누릅니다.</li>
                      <li><strong>'개인정보 보호 {"-> "} 권한 설정'</strong>에서 마이크 액세스를 <strong>허용</strong>으로 켭니다.</li>
                      <li>페이지를 새로고침한 뒤 다시 시도해 주세요.</li>
                    </ol>
                  ) : micBrowserType === 'safari' ? (
                    <ol className="list-decimal pl-4 space-y-1.5 text-slate-300 text-[11px]">
                      <li>주소창 왼쪽의 <strong>'한한(또는 aA)'</strong> 아이콘을 탭합니다.</li>
                      <li><strong>'웹사이트 설정'</strong>을 선택합니다.</li>
                      <li>마이크 설정을 <strong>'허용'</strong>으로 변경해 주세요.</li>
                      <li>새로고침 후 다시 통화를 시도합니다.</li>
                    </ol>
                  ) : micBrowserType === 'chrome' ? (
                    <ol className="list-decimal pl-4 space-y-1.5 text-slate-300 text-[11px]">
                      <li>주소창 왼쪽의 <strong>'설정/슬라이더 아이콘'</strong>을 탭합니다.</li>
                      <li><strong>'사이트 설정 {"-> "} 마이크 권한'</strong>으로 들어갑니다.</li>
                      <li>차단됨을 <strong>'허용'</strong> 상태로 변경합니다.</li>
                      <li>새로고침한 뒤 다시 시작해 보세요.</li>
                    </ol>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                      <li>주소창 근처의 <strong>자물쇠/설정 아이콘</strong>을 눌러보세요.</li>
                      <li>마이크 권한이 <strong>차단</strong>되어 있다면 <strong>허용</strong>으로 활성화해 주세요.</li>
                      <li>스마트폰 기기 설정에서 브라우저 앱의 마이크 권한이 켜져 있는지도 함께 확인해 주세요.</li>
                    </ul>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => setIsMicModalOpen(false)}
                className="w-full mt-6 h-11 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                확인했습니다
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
