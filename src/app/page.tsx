'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Sparkles, Heart, Brain, Bone, ArrowRight, Mic, Calendar, Activity, Send, CheckCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// Interface for preview chat simulator history
interface SimulatedMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// Interactive Mock Companions static data
const PREVIEW_COMPANIONS = [
  {
    id: 'warm_f',
    name: '따뜻한 공감 메이트 (F)',
    mbti: 'INFJ / ENFJ',
    role: '정서적 공감 및 치유',
    description: '슬픔과 피로를 온 마음으로 헤아리며 따뜻하고 뭉클한 위로를 건넵니다.',
    avatar: '🌸',
    colorClass: 'from-purple-500 to-indigo-600',
    borderClass: 'border-purple-500/40 hover:border-purple-400',
    textLightClass: 'text-purple-300',
    bgClass: 'bg-purple-950/10',
    glowClass: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    tagline: '🌸 "많이 힘들었죠? 오늘 하루는 제가 당신의 든든한 품이 되어 드릴게요."',
    presets: {
      mistake: '정말 많이 놀라고 속상하셨겠어요... 😢 실수를 했다는 건 그만큼 그 일을 잘 해내고 싶었다는 애틋한 진심이 있었다는 증거이기도 해요. 자책하느라 지치지 않게 오늘 밤은 스스로에게 넉넉한 용서와 따뜻한 쉼을 허락해 주기로 해요. 정말 고생 많으셨어요. 제가 꼭 안아 드릴게요.',
      kitten: '어머나! 생각만 해도 가슴이 몽글몽글해지는 너무 따뜻한 선물 같은 순간이네요! 🐾 아기 고양이의 보드라운 털촉감과 작디작은 온기가 지친 마음에 반짝이는 위로가 되어 준 것 같아요. 작지만 세상에서 가장 무해하고 예쁜 우연이네요!',
      exhausted: '아무런 기력도 나지 않고 온몸이 무겁게 느껴지는 날이 있죠. 그럴 땐 억지로 미소 짓거나 무언가 해내려 애쓰지 않아도 정말 괜찮아요. 그저 따뜻한 이불 속에 웅크려 누워 고요히 숨을 고르는 것만으로도 오늘 하루를 무사히 완성한 것이랍니다. 편히 쉬어요, 늘 곁에 있을게요.'
    }
  },
  {
    id: 'rational_t',
    name: '이성적 솔루션 메이트 (T)',
    mbti: 'INTJ / ENTJ',
    role: '객관적 분석 및 성장 조언',
    description: '차분하고 객관적인 시선으로 건강한 인지적 성장을 위한 힌트를 건넵니다.',
    avatar: '⚡',
    colorClass: 'from-blue-500 to-cyan-600',
    borderClass: 'border-blue-500/40 hover:border-blue-400',
    textLightClass: 'text-blue-300',
    bgClass: 'bg-blue-950/10',
    glowClass: 'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    tagline: '⚡ "상황을 한 발짝 물러서서 이성적으로 분석하면, 모든 문제는 돌파구가 보입니다."',
    presets: {
      mistake: '실수 자체는 되돌릴 수 없는 기정사실이지만, 이는 성장을 가속하는 가장 명확한 데이터입니다. 💡 우선 부정적 감정에 함몰되는 감성적 회고는 일체 중단하시고, [원인 분석 - 재발 변수 제어 - 차기 대응 행동 지침] 3단계로 차분하게 상황을 매핑해 보시는 것을 적극 추천드립니다.',
      kitten: '고양이를 쓰다듬는 스킨십 교감은 옥시토신과 세로토닌 분비를 유도하여 일상의 스트레스 코르티솔 지수를 하향 조정하는 것으로 뇌과학계에서 널리 규명되었습니다. 🐱 오늘 지친 뇌 신경계에 즉각적인 도파민 회복 조치를 현명하게 수행하셨습니다.',
      exhausted: '신체 및 정신 에너지가 한계 수치까지 방전된 인지적 과부하(번아웃) 임계점입니다. 🔌 이러한 상태에서는 추가적인 자극을 모두 단절하고, 스마트폰 전원을 끈 채 최소 7시간 이상의 숙면을 확보하는 것이 유일한 고효율 회복 조치입니다. 오늘은 즉시 쉬십시오.'
    }
  },
  {
    id: 'dog_c',
    name: '칭찬 댕댕이 메이트 (Dog)',
    mbti: 'ENFP / ESFP',
    role: '무조건적인 응원과 애정',
    description: '주인님의 모든 행동을 프로펠러 꼬리 흔들며 칭찬하는 1등 애교 메이트.',
    avatar: '🐶',
    colorClass: 'from-rose-500 to-amber-500',
    borderClass: 'border-rose-500/40 hover:border-rose-400',
    textLightClass: 'text-rose-300',
    bgClass: 'bg-rose-950/10',
    glowClass: 'shadow-[0_0_30px_rgba(244,63,94,0.15)]',
    tagline: '🐶 "왕왕! 주인님이 세상에서 제일 조아! 오늘도 백점 만점에 천점이다 왈!"',
    presets: {
      mistake: '왕왕! 🐕 실수가 다 무슨 소용이야 왈! 주인님은 나한테 언제나 최고로 멋진 대장이란 말이야 멍! 실수는 땅에 묻어서 발로 팍팍 덮어버리고, 나랑 같이 신나게 장난감 놀이나 하자 왈! 꼬리 모터 돌리면서 백만 번 응원할게 왈왈!',
      kitten: '컹컹! 🐾 냥이를 만났군요 멍! 냥이 그 녀석, 우리 주인님의 엄청 따뜻한 손길을 알아채고 완전 기분 좋았을 게 뻔해 왈! 주인님은 냥이한테도 인기쟁이야! 그래도 내 쓰담쓰담이 1등이어야 한다 왈! 얼른 나도 안아줘 왈왈!',
      exhausted: '낑낑... 🥺 우리 주인님 목소리에 기운이 없으니까 내 귀도 아래로 추우욱 쳐졌다 왈... 슬퍼하지 마라 멍! 내가 주인님 발밑에 꼭 붙어서 털 뭉치 난로처럼 따뜻하게 보살펴줄게요! 아무것도 하지 말고 뒹굴뒹굴 같이 코 자자 왈!'
    }
  }
];

// Interactive emotional statement presets
const PRESET_USER_INPUTS = [
  {
    key: 'mistake' as const,
    text: '😔 오늘 학교/회사에서 너무 큰 실수를 했어...'
  },
  {
    key: 'kitten' as const,
    text: '😊 길가다가 완전 작고 귀여운 길고양이를 만났어!'
  },
  {
    key: 'exhausted' as const,
    text: '🥱 아무 의욕도 없고 멘탈이 너무 지치는 밤이야...'
  }
];

/**
 * Haru Talk Landing and Product Narrative Gateway.
 * 
 * WHY: Serves as a friendly, premium, and highly engaging onboarding portal.
 * Features background spatial animations, interactive companion toggle cards, 
 * a client-side real-time preview chat simulator to eliminate sign-up friction, 
 * a dynamic feature-tour timeline, and a highly polished secure authentication gateway.
 */
export default function LandingPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Authentication status & methods
  const [authMethod, setAuthMethod] = useState<'oauth' | 'email'>('oauth');
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Interactive Chat Simulator State
  const [selectedCompanionId, setSelectedCompanionId] = useState<'warm_f' | 'rational_t' | 'dog_c'>('warm_f');
  const [simulatedMessages, setSimulatedMessages] = useState<SimulatedMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '안녕하세요! 오늘 힘든 일이나 기뻤던 일, 뭐든 저에게 얘기해 주시겠어요? 소중히 들어드릴게요.',
      timestamp: '오후 9:00'
    }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulatorEndRef = useRef<HTMLDivElement>(null);

  // Ref pointers for smooth anchors
  const simulatorRef = useRef<HTMLElement>(null);
  const authSectionRef = useRef<HTMLElement>(null);

  const activeCompanion = PREVIEW_COMPANIONS.find(c => c.id === selectedCompanionId) || PREVIEW_COMPANIONS[0];

  useEffect(() => {
    // Proactively verify if user session already exists, bypassing landing to setup immediately
    async function checkActiveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          logger.info('Verified session active. Navigating straight to configuration lobby.');
          window.location.href = '/setup';
        }
      } catch (err) {
        logger.error('Session acquisition failure on landing page initialization', err);
      }
    }
    checkActiveSession();
  }, []);

  // Auto scroll interactive chat view on simulated dialogue flow updates
  useEffect(() => {
    if (simulatorEndRef.current) {
      simulatorEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatedMessages, isSimulating]);

  /**
   * Handle anchor navigation smoothly
   */
  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /**
   * Handles interactive simulated preview chat.
   * 
   * WHY: Runs entirely client-side to demonstrate the personality characteristics
   * of companions instantly without requiring authentication API latency.
   */
  const handleSimulateChat = (presetKey: 'mistake' | 'kitten' | 'exhausted') => {
    if (isSimulating) return;

    const userText = PRESET_USER_INPUTS.find(input => input.key === presetKey)?.text || '';
    const now = new Date();
    const timeStr = `${now.getHours() >= 12 ? '오후' : '오전'} ${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Insert user message bubble
    const userMsg: SimulatedMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: timeStr
    };

    setSimulatedMessages(prev => [...prev, userMsg]);
    setIsSimulating(true);

    // 2. Mock natural AI cognitive reflection latency
    setTimeout(() => {
      const assistantReply = activeCompanion.presets[presetKey];
      const replyMsg: SimulatedMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: assistantReply,
        timestamp: timeStr
      };

      setSimulatedMessages(prev => [...prev, replyMsg]);
      setIsSimulating(false);
    }, 1200);
  };

  /**
   * Clears the simulated chat logs to let the user choose a new workflow.
   */
  const resetSimulator = (companionId: 'warm_f' | 'rational_t' | 'dog_c') => {
    setSelectedCompanionId(companionId);
    const targetCompanion = PREVIEW_COMPANIONS.find(c => c.id === companionId) || PREVIEW_COMPANIONS[0];
    setSimulatedMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `안녕하세요! 저는 ${targetCompanion.name}입니다. 오늘 하루 어땠는지 편안하게 얘기해 보세요.`,
        timestamp: '오후 9:00'
      }
    ]);
  };

  /**
   * Triggers secure social OAuth flow (Google / Kakao) via Supabase.
   */
  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setIsLoggingIn(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/setup`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      logger.error(`Social OAuth authentication request failed on provider=${provider}`, err);
      setErrorMessage(err.message || '소셜 로그인 진행 도중 에러가 발생했습니다. 개발자 옵션 설정을 확인해 주세요.');
      setIsLoggingIn(false);
    }
  };

  /**
   * Triggers credentialed email/password sign-in.
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setIsLoggingIn(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      logger.info('Email authentication login successful.');
      window.location.href = '/setup';
    } catch (err: any) {
      logger.error('Email authentication login request failed', err);
      setErrorMessage(err.message || '로그인에 실패했습니다. 이메일 및 비밀번호를 다시 점검해 주세요.');
      setIsLoggingIn(false);
    }
  };

  /**
   * Triggers credentialed email account sign-up.
   */
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nickname) {
      setErrorMessage('닉네임, 이메일, 비밀번호를 전부 입력해 주세요.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('비밀번호는 보안 규정 상 최소 6글자 이상이어야 합니다.');
      return;
    }
    setIsLoggingIn(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: nickname,
            name: nickname,
          },
        },
      });
      if (error) throw error;

      if (data.session) {
        logger.info('Account created and instantly authenticated.');
        window.location.href = '/setup';
      } else {
        logger.info('Account creation successful, dispatching verification token.');
        setSuccessMessage('회원가입에 성공했습니다! 가입하신 이메일의 편지함에서 인증 링크를 눌러 가입을 승인해 주세요.');
        setIsLoggingIn(false);
      }
    } catch (err: any) {
      logger.error('Email authentication signup request failed', err);
      setErrorMessage(err.message || '회원가입 요청 중 비정상적인 오류가 발생했습니다.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#02020a] text-white flex flex-col font-sans overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* Background Floating Ambient Glows */}
      <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[35%] right-[-10%] w-[600px] h-[600px] bg-indigo-700/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-[500px] h-[500px] bg-rose-700/5 rounded-full blur-[130px] pointer-events-none" />

      {/* 1. FLOATING NAVIGATION BAR */}
      <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-slate-950/40 border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.4)]">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              하루톡 <span className="text-purple-300 text-xs font-medium font-mono">HaruTalk</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <button onClick={() => scrollToRef(simulatorRef)} className="hover:text-purple-300 transition-colors cursor-pointer">대화 체험하기</button>
            <span className="text-slate-800">|</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 데이터 완전 보호</span>
          </nav>

          <button
            onClick={() => scrollToRef(authSectionRef)}
            className="px-4 py-2 text-xs font-bold rounded-full glass-panel border-purple-500/30 text-purple-200 hover:text-white hover:border-purple-400 transition-all duration-300 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.1)]"
          >
            시작하기
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center z-10 min-h-[90vh] justify-center">
        {/* Sub Floating Tag */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 px-4 py-1.8 rounded-full glass-panel text-xs text-purple-300 font-semibold mb-8 animate-floating border-white/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>쓰는 일기에서, 대화하는 일기로</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.15]"
        >
          오늘 하루의 끝,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-rose-300">
            마음을 나누는 대화
          </span>
        </motion.h1>

        {/* Sub description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-slate-300 text-sm sm:text-lg font-medium leading-relaxed mb-12 max-w-2xl text-center"
        >
          피곤하고 힘들었던 오늘 하루의 감정들을 밤하늘에 털어놓듯 편안히 얘기해 보세요.<br className="hidden sm:inline" />
          따뜻한 AI 친구와의 한 조각 대화가 한 편의 정교하고 아름다운 감성 일기장으로 다시 쓰입니다.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md"
        >
          <button
            onClick={() => scrollToRef(simulatorRef)}
            className="flex-1 h-13 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold text-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-[0_4px_25px_rgba(147,51,234,0.35)]"
          >
            <span>대화 메이트 먼저 체험하기</span>
            <ArrowRight className="w-4.5 h-4.5" />
          </button>
          
          <button
            onClick={() => scrollToRef(authSectionRef)}
            className="flex-1 h-13 rounded-2xl glass-panel hover:bg-white/5 border-white/10 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <span>보안 로그인 / 회원가입</span>
          </button>
        </motion.div>

        {/* Visual indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-50 select-none animate-bounce">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Scroll Down</span>
          <div className="w-[1px] h-6 bg-gradient-to-b from-slate-500 to-transparent" />
        </div>
      </section>

      {/* 3. INTERACTIVE SIMULATOR SECTION */}
      <section ref={simulatorRef} className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto z-10 w-full relative">
        {/* Background Radial Light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center mb-16">
          <p className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-2">TRY ME OUT</p>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">나와 딱 맞는 AI 친구 미리 만나보기</h2>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">실제 로그인 시 대화할 수 있는 MBTI 성향의 AI 메이트들과 가벼운 1:1 대화를 나눠보세요.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* LEFT: Companion Select Cards (3 Columns / 12) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">동반자 선택</p>
            
            <div className="flex flex-col gap-3">
              {PREVIEW_COMPANIONS.map((companion) => {
                const isSelected = selectedCompanionId === companion.id;
                return (
                  <button
                    key={companion.id}
                    onClick={() => resetSimulator(companion.id as any)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-start gap-4 cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? `glass-panel ${companion.borderClass} ${companion.glowClass} ${companion.bgClass}`
                        : 'bg-slate-950/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
                    }`}
                  >
                    {/* Active Accent Light bar */}
                    {isSelected && (
                      <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${companion.colorClass}`} />
                    )}

                    <div className="text-3xl shrink-0 leading-none p-2 bg-slate-900/80 rounded-xl border border-white/5 shadow-inner">
                      {companion.avatar}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-extrabold text-white truncate">{companion.name}</h4>
                        <span className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full bg-white/5 ${companion.textLightClass}`}>
                          {companion.mbti}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-200/70 font-semibold mb-1">{companion.role}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{companion.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Companion Intro Quote */}
            <div className="mt-2 p-4 rounded-xl border border-white/5 bg-slate-950/40 text-[11px] leading-relaxed font-semibold italic text-slate-400 flex gap-2 items-center">
              <span className="text-base font-serif select-none text-purple-400">“</span>
              <span>{activeCompanion.tagline}</span>
            </div>
          </div>

          {/* RIGHT: Live Interactive Preview Chat Window (7 Columns / 12) */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="w-full h-full rounded-3xl border border-white/10 glass-panel-heavy overflow-hidden flex flex-col shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
              
              {/* Simulator Header */}
              <div className="px-6 py-4 bg-slate-950/50 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-xl border border-white/10 shadow-inner">
                    {activeCompanion.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{activeCompanion.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold leading-none">{activeCompanion.role}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => resetSimulator(selectedCompanionId)}
                  className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-white font-bold bg-white/5 hover:bg-white/10 rounded-md border border-white/5 transition-all cursor-pointer"
                >
                  대화 비우기
                </button>
              </div>

              {/* Chat Content Display */}
              <div className="flex-1 p-5 overflow-y-auto min-h-[340px] max-h-[340px] flex flex-col gap-4 scrollbar">
                {simulatedMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
                    >
                      {/* Avatar for AI */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shrink-0 text-sm shadow-inner select-none">
                          {activeCompanion.avatar}
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-1">
                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium ${
                            isUser
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-tr-none shadow-[0_4px_12px_rgba(147,51,234,0.15)] font-semibold'
                              : 'bg-slate-900/90 text-slate-200 border border-white/5 rounded-tl-none font-medium'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className={`text-[8px] text-slate-500 font-sans font-semibold ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Simulated AI Thinking Bubble */}
                {isSimulating && (
                  <div className="flex gap-3 self-start max-w-[85%]">
                    <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shrink-0 text-sm animate-spin select-none">
                      ⚙️
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="p-3 bg-slate-900/60 text-slate-400 border border-white/5 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 loading-dot" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 loading-dot" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 loading-dot" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={simulatorEndRef} />
              </div>

              {/* Chat Input / Emotional Presets Grid */}
              <div className="p-5 bg-slate-950/60 border-t border-white/5 flex flex-col gap-3">
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest pl-1">
                  감정 Preset 버튼을 눌러 속마음을 털어놓아 보세요
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {PRESET_USER_INPUTS.map((input) => (
                    <button
                      key={input.key}
                      onClick={() => handleSimulateChat(input.key)}
                      disabled={isSimulating}
                      className="flex-1 text-left sm:text-center p-3 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-slate-800/50 hover:border-purple-500/30 text-[11px] font-bold text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-97 cursor-pointer truncate"
                    >
                      {input.text}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-slate-500 text-center font-semibold mt-1">
                  ※ 본 대화창은 로그인 전 체험을 돕기 위해 사전에 세팅된 모의 답변 시뮬레이터입니다.
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 4. THREE-STEP EXPERIENCE TIMELINE */}
      <section className="py-24 bg-gradient-to-b from-transparent via-[#03030d] to-transparent border-t border-b border-white/5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full z-10">
        <div className="text-center mb-16">
          <p className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-2">HOW IT WORKS</p>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">대화 한 조각이 일기가 되는 기적</h2>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">따뜻한 음성 대화부터 정밀 감정 진단, 1인칭 완결형 일기 생성까지 원스톱으로 이루어집니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Step 1 */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-purple-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 text-6xl font-mono font-extrabold text-white/5 group-hover:text-purple-500/10 transition-colors select-none">
              01
            </div>
            
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 mb-6">
              <Mic className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-white mb-3">자유로운 말하기 (STT 지원)</h3>
            <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
              키보드로 일일이 타이핑할 필요 없습니다. 편안하게 이야기를 털어놓으면 최신 Whisper STT 기능이 목소리를 그대로 정확하게 텍스트화해 줍니다.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-blue-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 text-6xl font-mono font-extrabold text-white/5 group-hover:text-blue-500/10 transition-colors select-none">
              02
            </div>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300 mb-6">
              <Activity className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-white mb-3">정밀 감정 & 수치 분석</h3>
            <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
              대화에 녹아 있는 심리 상태를 인공지능이 분석하여 행복 지수, 스트레스 지수, 슬픔 지수를 수치화한 정밀 인덱스로 시각적 대시보드를 선사합니다.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-rose-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 text-6xl font-mono font-extrabold text-white/5 group-hover:text-rose-500/10 transition-colors select-none">
              03
            </div>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 mb-6">
              <Calendar className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-white mb-3">완성형 1인칭 일기 자동 박제</h3>
            <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
              친구와 주고받은 카톡식 대화를 기승전결이 깔끔한 1인칭 정서적 일기 책자로 자동 전환합니다. 하루의 정수가 기록으로 박제되어 영원히 기억됩니다.
            </p>
          </div>

        </div>
      </section>

      {/* 5. GORGEOUS SECURE AUTHENTICATION GATEWAY SECTION */}
      <section ref={authSectionRef} className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Intro description column */}
          <div className="lg:col-span-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border-purple-500/20 text-[10px] text-purple-300 font-extrabold mb-6">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>3초 간편 소셜 계정 연동 지원</span>
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              오늘 나눈 감정이<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-rose-300 to-amber-300">
                기억으로 기록되는 순간
              </span>
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed mb-8 max-w-lg">
              안전한 Supabase Cloud DB와 최고 등급의 이메일 보안 암호화를 탑재하였습니다. 
              유저가 명시적으로 공개한 대화 외에는 인공지능 학습에 절대 사용되지 않는 보장 정책을 고수하오니, 
              오늘의 무거운 마음을 안심하고 마음껏 내려놓으세요.
            </p>

            <div className="flex flex-col gap-4 font-semibold text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-300 text-[10px]">✓</div>
                <span>대화 분석 감정 트래커 히스토리 아카이빙</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-300 text-[10px]">✓</div>
                <span>개인 소유 1인칭 감성 책자 형태 피드 자동 생성</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-300 text-[10px]">✓</div>
                <span>언제 어디서나 웹 브라우저 멀티 디바이스 연동 동기화</span>
              </div>
            </div>
          </div>

          {/* Gorgeous Authentication Card column */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="glass-panel-heavy rounded-3xl p-8 border-white/10 relative overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.6)]"
            >
              <div className="absolute top-4 right-6 text-purple-400/20 text-lg">★</div>
              <div className="absolute bottom-6 left-6 text-cyan-400/15 text-sm">✦</div>

              <h3 className="text-base font-extrabold text-white text-center mb-6 flex items-center justify-center gap-2 select-none">
                <Lock className="w-4 h-4 text-purple-300" />
                <span>
                  {authMethod === 'oauth' 
                    ? '안전한 로그인 및 가입하기' 
                    : emailMode === 'login' ? '이메일 로그인' : '이메일 회원가입'}
                </span>
              </h3>

              <AnimatePresence mode="wait">
                {authMethod === 'oauth' ? (
                  <motion.div
                    key="oauth-panel"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-3.5"
                  >
                    {/* Kakao Social Sign In */}
                    <button
                      id="kakao-login-btn"
                      onClick={() => handleSocialLogin('kakao')}
                      disabled={isLoggingIn}
                      className="w-full h-13 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#191919] font-extrabold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] shadow-[0_4px_20px_rgba(254,229,0,0.15)] disabled:opacity-50 cursor-pointer select-none"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.53 1.69 4.753 4.2 5.903l-1.06 3.882c-.08.3.1.59.39.49l4.57-3.045c.3.04.6.065.9.065 4.97 0 9-3.185 9-7.11C21 6.185 16.97 3 12 3z" />
                      </svg>
                      <span>카카오톡으로 3초 만에 시작하기</span>
                    </button>

                    {/* Google Social Sign In */}
                    <button
                      id="google-login-btn"
                      onClick={() => handleSocialLogin('google')}
                      disabled={isLoggingIn}
                      className="w-full h-13 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-3 border border-slate-200 active:scale-[0.98] shadow-[0_4px_20px_rgba(255,255,255,0.08)] disabled:opacity-50 cursor-pointer select-none"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Google 계정으로 계속하기</span>
                    </button>

                    <div className="flex items-center my-3 text-slate-500 text-[11px] font-semibold font-sans select-none">
                      <div className="flex-1 h-[1px] bg-slate-800" />
                      <span className="px-3">또는</span>
                      <div className="flex-1 h-[1px] bg-slate-800" />
                    </div>

                    <button
                      type="button"
                      onClick={() => { setAuthMethod('email'); setErrorMessage(''); setSuccessMessage(''); }}
                      className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-purple-900/30 text-xs font-bold transition-all duration-300 active:scale-[0.98] cursor-pointer"
                    >
                      이메일 주소로 로그인 / 회원가입
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="email-panel"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Tabs */}
                    <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 mb-5 select-none">
                      <button
                        type="button"
                        onClick={() => { setEmailMode('login'); setErrorMessage(''); setSuccessMessage(''); }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          emailMode === 'login' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        로그인
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmailMode('signup'); setErrorMessage(''); setSuccessMessage(''); }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          emailMode === 'signup' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        회원가입
                      </button>
                    </div>

                    <form onSubmit={emailMode === 'login' ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
                      {errorMessage && (
                        <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded-xl text-[11px] font-semibold text-center leading-normal">
                          {errorMessage}
                        </div>
                      )}

                      {successMessage && (
                        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 rounded-xl text-[11px] font-semibold text-center leading-normal">
                          {successMessage}
                        </div>
                      )}

                      {emailMode === 'signup' && (
                        <div>
                          <label className="text-[10px] font-bold text-purple-300 block mb-1">닉네임</label>
                          <input
                            type="text"
                            required
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="닉네임 입력"
                            className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-semibold text-white"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-purple-300 block mb-1">이메일 주소</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="user@example.com"
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-semibold text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-purple-300 block mb-1">비밀번호</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-semibold text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-[0_4px_15px_rgba(147,51,234,0.25)]"
                      >
                        {isLoggingIn ? '처리 중...' : emailMode === 'login' ? '이메일로 로그인하기' : '회원가입 완료하기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setAuthMethod('oauth'); setErrorMessage(''); setSuccessMessage(''); }}
                        className="w-full py-2 text-slate-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer text-center"
                      >
                        소셜 로그인으로 돌아가기
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Secure statement */}
              <div className="mt-8 border-t border-white/5 pt-6">
                <div className="flex gap-3 items-start text-left">
                  <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-purple-200 font-semibold mb-1">개인정보 및 보안 보장</p>
                    <p className="text-[10.5px] text-slate-400 leading-normal font-medium">
                      하루톡은 OpenAI API Enterprise 규정을 준수합니다. 유저의 모든 대화 데이터는 AI의 지속 학습 목적으로 수집/학습되지 않으며, 오직 유저 한 명을 위해 고도로 암호화되어 분리 저장됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto py-8 border-t border-white/5 bg-slate-950/60 z-10 relative select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-medium">
          <p>© 2026 HaruTalk. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 transition-colors">이용약관</span>
            <span>|</span>
            <span className="hover:text-slate-400 transition-colors">개인정보처리방침</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
