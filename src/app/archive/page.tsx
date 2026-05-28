'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, BookOpen, Trash2, X, Heart, ArrowLeft, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface ArchiveDiary {
  id: string;
  title: string;
  content: string;
  emotion: 'happy' | 'sad' | 'calm' | 'tired' | 'angry';
  date: string;
  sentiment_score: number;
}

/**
 * Haru Talk Archive Gallery Page.
 * 
 * WHY: Provides persistent diary history. Allows users to retrieve
 * all past generated diaries (from Supabase or local mock caches),
 * search/filter by dates, view them in rich expanding overlay modals,
 * and perform deletion operations safely.
 */
export default function ArchivePage() {
  const [diaries, setDiaries] = useState<ArchiveDiary[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<ArchiveDiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    async function checkArchiveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsMock(false);
          loadRealArchive();
          return;
        }
      } catch (err) {
        logger.error('Failed to retrieve user session on archive page', err);
      }

      setIsMock(true);
      loadMockArchive();
    }

    checkArchiveSession();
  }, []);

  /**
   * Retrieves simulated diaries stored in client local caches.
   */
  const loadMockArchive = () => {
    try {
      const mockDiaries = JSON.parse(localStorage.getItem('haru_talk_mock_diaries') || '[]');
      // Sort by date descending
      mockDiaries.sort((a: ArchiveDiary, b: ArchiveDiary) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDiaries(mockDiaries);
      setLoading(false);
      logger.info('Simulated diaries fetched successfully.');
    } catch (err) {
      logger.error('Failed to parse simulated diaries', err);
      setLoading(false);
    }
  };

  /**
   * Fetches real SQL diaries entries ordered by target calendar dates.
   */
  const loadRealArchive = async () => {
    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (!supabaseSession?.user) {
        window.location.href = '/';
        return;
      }
      setToken(supabaseSession.access_token);

      const { data: dbDiaries, error } = await supabase
        .from('diaries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (dbDiaries) {
        setDiaries(dbDiaries.map((d: any) => ({
          id: d.id,
          title: d.title,
          content: d.content,
          emotion: d.emotion as 'happy' | 'sad' | 'calm' | 'tired' | 'angry',
          date: d.date,
          sentiment_score: d.sentiment_score,
        })));
      }
    } catch (err) {
      logger.error('Failed to fetch real diaries archive', err);
      alert('일기 아카이브 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Performs database deletion or mock array splicing operations.
   */
  const handleDeleteDiary = async (diaryId: string) => {
    if (!confirm('정말로 이 일기를 아카이브에서 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.')) {
      return;
    }

    if (isMock) {
      const mockDiaries = JSON.parse(localStorage.getItem('haru_talk_mock_diaries') || '[]');
      const filtered = mockDiaries.filter((d: ArchiveDiary) => d.id !== diaryId);
      localStorage.setItem('haru_talk_mock_diaries', JSON.stringify(filtered));
      setDiaries(filtered);
      setSelectedDiary(null);
      logger.info(`Simulated diary=${diaryId} deleted successfully.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('diaries')
        .delete()
        .eq('id', diaryId);

      if (error) throw error;

      setDiaries(prev => prev.filter(d => d.id !== diaryId));
      setSelectedDiary(null);
      logger.info(`Database diary=${diaryId} deleted successfully.`);
    } catch (err) {
      logger.error('Failed to delete database diary', err);
      alert('데이터베이스 일기 삭제에 실패했습니다.');
    }
  };

  /**
   * Translates active emotion keys to appropriate emoticons and colors.
   */
  const getEmotionMetadata = (emotion: string) => {
    switch (emotion) {
      case 'happy':
        return { emoji: '☀️', text: '기쁨', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
      case 'sad':
        return { emoji: '🌧️', text: '슬픔', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' };
      case 'calm':
        return { emoji: '🍃', text: '평온', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
      case 'tired':
        return { emoji: '☕', text: '지침', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' };
      case 'angry':
        return { emoji: '⚡', text: '속상', color: 'text-rose-300 border-rose-500/30 bg-rose-500/10' };
      default:
        return { emoji: '🌙', text: '보통', color: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10' };
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041a]">
      {/* Glow Ambience */}
      <div className="absolute top-10 left-10 w-[200px] h-[200px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* TOP HEADER BAR */}
      <header className="w-full max-w-xl flex justify-between items-center z-10 mb-8 select-none">
        <button
          onClick={() => window.location.href = '/setup'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>메인으로</span>
        </button>

        <h1 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-300" />
          <span>나의 밤의 일기장 회고첩</span>
        </h1>

        <button
          onClick={() => window.location.href = '/setup'}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-[10px] font-bold shadow-[0_2px_10px_rgba(167,139,250,0.15)] transition-all"
        >
          <Heart className="w-3 h-3 text-purple-200" />
          <span>새 일기 쓰기</span>
        </button>
      </header>

      {/* DYNAMIC LIST GALLERIES */}
      <section className="w-full max-w-xl z-10 flex-1">
        
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <span>회고 기록첩을 가지런히 정돈하는 중...</span>
          </div>
        ) : diaries.length === 0 ? (
          /* Empty indicator */
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 max-w-md mx-auto mt-10">
            <ShieldAlert className="w-12 h-12 text-purple-400/40 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-white mb-1.5">기록된 일기가 아직 없어요</h3>
            <p className="text-xs text-slate-400 leading-normal mb-6">
              밤하늘의 친구와 대화를 나누고 첫 일기장을 소중하게 박제해 보세요!
            </p>
            <button
              onClick={() => window.location.href = '/setup'}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors active:scale-[0.98]"
            >
              첫 회고 대화 시작하기
            </button>
          </div>
        ) : (
          /* Gallery Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {diaries.map((diaryItem) => {
              const meta = getEmotionMetadata(diaryItem.emotion);
              return (
                <motion.div
                  key={diaryItem.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedDiary(diaryItem)}
                  className="cursor-pointer glass-panel rounded-2xl p-5 border border-slate-800/80 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(167,139,250,0.1)] transition-all flex flex-col justify-between h-44"
                >
                  <div>
                    {/* Header info */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        <span>{diaryItem.date}</span>
                      </div>
                      
                      {/* Emotion Badge */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${meta.color}`}>
                        {meta.emoji} {meta.text}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-bold text-white mb-2 line-clamp-1">
                      {diaryItem.title}
                    </h3>

                    {/* Body preview */}
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                      {diaryItem.content}
                    </p>
                  </div>

                  {/* Footer indicators */}
                  <div className="flex justify-between items-center text-[9px] font-bold text-purple-300/80 border-t border-slate-800/50 pt-2.5 mt-2">
                    <span>행복 에너지: {diaryItem.sentiment_score.toFixed(1)}/10</span>
                    <span className="text-slate-500">자세히 보기 →</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* DETAILED CARD MODAL EXPANSIONS */}
      <AnimatePresence>
        {selectedDiary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel-heavy rounded-3xl max-w-md w-full p-6 border border-purple-500/25 relative overflow-hidden"
            >
              {/* Corner close button */}
              <button
                onClick={() => setSelectedDiary(null)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Date Header */}
              <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-bold mb-3">
                <Calendar className="w-4 h-4" />
                <span>{selectedDiary.date}의 기록</span>
              </div>

              {/* Emotion Indicator line */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4 select-none">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getEmotionMetadata(selectedDiary.emotion).color}`}>
                  오늘의 무드: {getEmotionMetadata(selectedDiary.emotion).emoji} {getEmotionMetadata(selectedDiary.emotion).text}
                </span>

                <span className="text-[10px] font-bold text-slate-400">
                  정량 분석 에너지: {selectedDiary.sentiment_score.toFixed(1)}/10
                </span>
              </div>

              {/* Detailed Content */}
              <div className="max-h-64 overflow-y-auto pr-1 select-text">
                <h2 className="text-sm font-bold text-white mb-3 leading-snug">
                  "{selectedDiary.title}"
                </h2>
                
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line text-justify text-justify-inter-word font-medium">
                  {selectedDiary.content}
                </p>
              </div>

              {/* Action row (Delete, Share) */}
              <div className="flex gap-3 mt-6 border-t border-slate-800/80 pt-4">
                {/* Delete button */}
                <button
                  id="delete-diary-btn"
                  onClick={() => handleDeleteDiary(selectedDiary.id)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900/60 hover:bg-red-950/20 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-900/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>일기 영구 삭제</span>
                </button>

                {/* Close modal */}
                <button
                  onClick={() => setSelectedDiary(null)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all active:scale-[0.98]"
                >
                  확인 완료
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMock && (
        <p className="text-center text-[9px] text-purple-300/40 font-semibold mt-8 z-10">
          * 현재 가상 체험 모드에서 작성된 로컬 일기 목록을 출력하고 있습니다.
        </p>
      )}
    </main>
  );
}
