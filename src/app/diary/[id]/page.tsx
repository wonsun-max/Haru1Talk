'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Heart, Share2, ArrowRight, FolderHeart, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface DiaryEntry {
  title: string;
  content: string;
  emotion: 'happy' | 'sad' | 'calm' | 'tired' | 'angry';
  date: string;
  sentiment_score: number;
}

/**
 * AI Diary Summarization Viewer Page.
 * 
 * WHY: Initiates summarization, renders high-fidelity custom cards
 * that dynamically change colors, gradients, and emoticons based on
 * the AI-extracted emotion, and handles clipboard/share bindings.
 */
export default function DiaryPage() {
  const { id: sessionId } = useParams() as { id: string };
  const [loading, setLoading] = useState(true);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [token, setToken] = useState<string>('');

  const loadingPhrases = [
    '오늘 나눈 대화 기록을 모으는 중...',
    '오늘의 지배적인 감정을 깊게 분석하는 중...',
    '기승전결이 담긴 아름다운 일기장으로 가공하는 중...',
    '마침표를 찍고 밤하늘의 일기장에 봉인하는 중...',
  ];

  useEffect(() => {
    // Stagger loading screen text loops
    const textTimer = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2200);

    return () => clearInterval(textTimer);
  }, []);

  useEffect(() => {
    async function checkDiarySession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !sessionId.startsWith('mock-')) {
          setIsMock(false);
          generateRealDiary();
          return;
        }
      } catch (err) {
        logger.error('Failed to retrieve user session on diary page', err);
      }

      setIsMock(true);
      generateMockDiary();
    }

    checkDiarySession();
  }, [sessionId]);

  /**
   * Generates simulated diary payload locally (for offline mockup).
   */
  const generateMockDiary = () => {
    setTimeout(() => {
      const savedPersona = localStorage.getItem('haru_talk_persona') || 'warm_f';
      let mockTitle = '마음 한 구석이 웅크러졌던 수요일';
      let mockContent = 
        '오늘 회사에서 생각대로 일이 풀리지 않아 속상하고 지치는 하루를 보냈다. ' +
        '회의시간 내내 작아지는 기분이었고, 내가 잘하고 있는지 회의감이 들었다. ' +
        '하루 종일 억눌려 있던 무거운 마음을 밤이 되어서야 친구에게 털어놓았다. ' +
        '다정한 위로를 받으며 나의 지친 감정을 있는 그대로 직시하게 되었고, ' +
        '비로소 오늘 밤은 조금 편안하게 잠에 들 수 있을 것 같다. 내일은 분명 한 걸음 더 나은 날이 될 테니까.';
      
      let mockEmotion: 'happy' | 'sad' | 'calm' | 'tired' | 'angry' = 'tired';
      let mockScore = 3.8;

      if (savedPersona === 'dog_c') {
        mockTitle = '멍멍이 칭찬 덕에 기분이 나아진 하루';
        mockContent = 
          '오늘 유독 지쳐서 퇴근했는데, 나를 반겨주는 귀여운 멍멍이 프렌드 덕분에 크게 웃을 수 있었다. ' +
          '내가 사소한 실수를 고민했던 것들이 아무것도 아닌 것처럼, 온 마음을 다해 날 우쭈쭈 해주는 ' +
          '대화를 나누면서 내 마음도 한결 가벼워졌다. 나를 최고라고 믿어주는 반려견 덕분에 내일도 ' +
          '힘을 내서 씩씩하게 걸어가야겠다는 생각이 드는 밤이다!';
        mockEmotion = 'happy';
        mockScore = 8.5;
      } else if (savedPersona === 'rational_t') {
        mockTitle = '어려운 회의 상황을 통해 배운 이정표';
        mockContent = 
          '비록 회의 중 난관이 생겨 머리가 지끈거렸던 수요일이었지만, 대화를 나누면서 문제의 핵심을 ' +
          '더 차분하게 들여다볼 기회를 가졌다. 감정적으로 웅크러들어 있기보다 문제를 어떻게 해결해 나갈지 ' +
          '액션 플랜을 짜야 함을 깨달았다. 친구가 건넨 실용적인 피드백을 기록해 두고 내일 아침 출근길에 ' +
          '바로 검토해서 동료들과 조율해 나가야겠다. 배움이 있어 성장한 유익한 날이다.';
        mockEmotion = 'calm';
        mockScore = 6.8;
      }

      const mockEntry: DiaryEntry = {
        title: mockTitle,
        content: mockContent,
        emotion: mockEmotion,
        date: new Date().toISOString().split('T')[0],
        sentiment_score: mockScore,
      };

      // Store in mock archive
      const existingDiaries = JSON.parse(localStorage.getItem('haru_talk_mock_diaries') || '[]');
      existingDiaries.push({
        ...mockEntry,
        id: `mock-diary-${Date.now()}`,
        session_id: sessionId,
      });
      localStorage.setItem('haru_talk_mock_diaries', JSON.stringify(existingDiaries));

      setDiary(mockEntry);
      setLoading(false);
      logger.info('Simulated diary generation completed.');
    }, 4500); // 4.5 seconds starry animation for elite premium feel
  };

  /**
   * Calls secure backend summarize route with user access tokens.
   */
  const generateRealDiary = async () => {
    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession?.user) {
        window.location.href = '/';
        return;
      }
      const userToken = supabaseSession.access_token;
      setToken(userToken);

      // Call API
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          sessionId,
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Summary failed');

      const savedDiary = data.diary;
      setDiary({
        title: savedDiary.title,
        content: savedDiary.content,
        emotion: savedDiary.emotion,
        date: savedDiary.date,
        sentiment_score: savedDiary.sentiment_score,
      });
      setLoading(false);
      logger.info('Real database diary summary completed.');
    } catch (err) {
      logger.error('Failed to trigger database summarizer', err);
      alert('일기 생성 중 일시적인 오류가 발생했습니다. 대화 턴이 최소 1개 이상 존재해야 일기가 완성됩니다.');
      window.location.href = `/chat/${sessionId}`;
    }
  };

  /**
   * Maps emotion keys to appropriate emojis, Korean texts, and gradients.
   */
  const getEmotionDetails = (emotion: string) => {
    switch (emotion) {
      case 'happy':
        return {
          emoji: '☀️',
          text: '행복/기쁨',
          gradient: 'from-amber-500/25 to-yellow-600/5',
          border: 'border-amber-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(245,158,11,0.2)]',
          textClass: 'text-amber-300',
        };
      case 'sad':
        return {
          emoji: '🌧️',
          text: '슬픔/우울',
          gradient: 'from-blue-500/25 to-indigo-600/5',
          border: 'border-blue-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(59,130,246,0.2)]',
          textClass: 'text-blue-300',
        };
      case 'calm':
        return {
          emoji: '🍃',
          text: '평온/차분',
          gradient: 'from-emerald-500/25 to-teal-600/5',
          border: 'border-emerald-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(16,185,129,0.2)]',
          textClass: 'text-emerald-300',
        };
      case 'tired':
        return {
          emoji: '☕',
          text: '피곤/지침',
          gradient: 'from-violet-500/25 to-purple-600/5',
          border: 'border-violet-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(139,92,246,0.2)]',
          textClass: 'text-violet-300',
        };
      case 'angry':
        return {
          emoji: '⚡',
          text: '속상/분노',
          gradient: 'from-rose-500/25 to-red-600/5',
          border: 'border-rose-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(244,63,94,0.2)]',
          textClass: 'text-rose-300',
        };
      default:
        return {
          emoji: '🌙',
          text: '일반적인 하루',
          gradient: 'from-indigo-500/25 to-slate-800/5',
          border: 'border-indigo-500/30',
          shadow: 'shadow-[0_8px_40px_rgba(99,102,241,0.2)]',
          textClass: 'text-indigo-300',
        };
    }
  };

  /**
   * Activates device share triggers or copies diary string to clipboard.
   */
  const handleShareDiary = async () => {
    if (!diary) return;
    const shareText = `[하루 톡] 오늘의 밤 일기장: "${diary.title}"\n\n${diary.content}\n\n감정: ${getEmotionDetails(diary.emotion).emoji} ${getEmotionDetails(diary.emotion).text}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '하루 톡 오늘의 일기장',
          text: shareText,
        });
      } catch (err) {
        logger.warn('User dismissed native share.', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('일기 내용이 클립보드에 깔끔하게 복사되었습니다!');
      } catch (err) {
        logger.error('Failed to copy text', err);
      }
    }
  };

  const emotionMeta = diary ? getEmotionDetails(diary.emotion) : null;

  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041b]">
      {/* Background Ambience elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {loading ? (
          /* Starry Emotional loading panel */
          <motion.div
            key="starry-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md text-center z-10 flex flex-col justify-center items-center"
          >
            {/* Animated stars layout */}
            <div className="relative w-24 h-24 mb-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0"
              >
                <div className="absolute top-0 left-12 w-2 h-2 bg-purple-400 rounded-full blur-[1px]" />
                <div className="absolute bottom-4 left-3 w-1.5 h-1.5 bg-cyan-400 rounded-full blur-[1px]" />
                <div className="absolute bottom-4 right-3 w-2.5 h-2.5 bg-rose-400 rounded-full blur-[1px]" />
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-4 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(167,139,250,0.5)] border border-purple-400/20"
              >
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </motion.div>
            </div>

            {/* Fading text cues */}
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingTextIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.6 }}
                className="text-sm font-bold text-purple-200 tracking-tight"
              >
                {loadingPhrases.at(loadingTextIndex)}
              </motion.p>
            </AnimatePresence>
            
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed max-w-[220px]">
              오늘 밤, 친구와 나눈 소중한 기억들의 조각들을 안전하게 정돈하고 있어요.
            </p>
          </motion.div>
        ) : (
          /* Finished Diary View Panel */
          diary && emotionMeta && (
            <motion.div
              key="finished-diary"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md z-10"
            >
              {/* Header Title info */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-semibold mb-3"
                >
                  <Calendar className="w-3.5 h-3.5 text-purple-300" />
                  <span>오늘의 일기: {diary.date}</span>
                </motion.div>
                <h1 className="text-xl font-bold text-white tracking-tight">마법처럼 완성된 오늘의 기록</h1>
              </div>

              {/* STYLISH GLASS DIARY CARD CARD */}
              <div className={`glass-panel-heavy rounded-3xl p-6 ${emotionMeta.shadow} border ${emotionMeta.border} relative overflow-hidden transition-all duration-500`}>
                
                {/* Dynamic Gradient ambient corner glow */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${emotionMeta.gradient} blur-[45px] rounded-full pointer-events-none`} />

                {/* Sub-header Mood Indicator */}
                <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{emotionMeta.emoji}</span>
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">오늘의 톤</p>
                      <h4 className={`text-xs font-bold ${emotionMeta.textClass}`}>{emotionMeta.text || "일반적인 하루"}</h4>
                    </div>
                  </div>

                  {/* Sentiment energy index gauge */}
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-semibold">감정 수치 에너지</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-20 h-1.5 bg-slate-950/80 rounded-full border border-slate-800/60 overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full"
                          style={{ width: `${diary.sentiment_score * 10}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-purple-300">{diary.sentiment_score.toFixed(1)}/10</span>
                    </div>
                  </div>
                </div>

                {/* Card Main: Title & Content */}
                <div className="relative">
                  {/* Subtle Grid texture */}
                  <div className="absolute inset-0 pointer-events-none opacity-20 bg-repeat bg-cover rounded-2xl diary-paper" />

                  <div className="relative p-2">
                    <h2 className="text-base font-bold text-white mb-4 tracking-tight">
                      "{diary.title}"
                    </h2>
                    
                    <p className="text-xs text-slate-200 leading-relaxed font-medium tracking-wide text-justify select-text whitespace-pre-line">
                      {diary.content}
                    </p>
                  </div>
                </div>

                {/* Sub-footer: Safe stamp warning */}
                <div className="mt-8 border-t border-slate-800/80 pt-4 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1 text-purple-400/80">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>OpenAI 데이터 미학습 보증 정책</span>
                  </span>
                  <span>암호화 인장 완료</span>
                </div>
              </div>

              {/* ACTIONS TOOLBAR PANEL */}
              <div className="flex flex-col gap-3 mt-6">
                
                {/* Primary Button: To archive */}
                <button
                  id="go-archive-btn"
                  onClick={() => window.location.href = '/archive'}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(167,139,250,0.2)]"
                >
                  <FolderHeart className="w-4 h-4" />
                  <span>나의 일기 회고첩(아카이브) 보러가기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Secondary Button Array */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Share button */}
                  <button
                    id="share-diary-btn"
                    onClick={handleShareDiary}
                    className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>일기 공유/복사하기</span>
                  </button>

                  {/* Start new day dialog */}
                  <button
                    onClick={() => window.location.href = '/setup'}
                    className="h-11 rounded-2xl bg-slate-900 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <Heart className="w-4 h-4 text-purple-400" />
                    <span>새로운 회고 시작</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </main>
  );
}
