'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, BookOpen, Trash2, X, Heart, ArrowLeft, ShieldAlert, Edit3, Plus, Grid, Save, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface ArchiveDiary {
  id: string;
  session_id: string;
  title: string;
  content: string;
  emotion: 'happy' | 'sad' | 'calm' | 'tired' | 'angry';
  date: string;
  sentiment_score: number;
}

/**
 * Premium Monthly Calendar and Diary Archive Gallery.
 * 
 * WHY: Provides a robust monthly grid calendar view of the user's emotional entries,
 * allowing inline editing, manual past-date creations, and toggleable card list grids
 * in high-fidelity dark glassmorphic styling.
 */
export default function ArchivePage() {
  const router = useRouter();
  const [diaries, setDiaries] = useState<ArchiveDiary[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<ArchiveDiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'gallery'>('calendar');

  // Past chat replay states
  const [activeTab, setActiveTab] = useState<'diary' | 'chat'>('diary');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Fetch chat messages for selected session
  const fetchChatMessages = async (sessId: string) => {
    setLoadingChat(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
    } catch (err) {
      logger.error('Failed to load chat history inside archive', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleTabChange = (tab: 'diary' | 'chat') => {
    setActiveTab(tab);
    if (tab === 'chat' && chatMessages.length === 0 && selectedDiary) {
      fetchChatMessages(selectedDiary.session_id);
    }
  };

  // Month navigation state (defaults to today)
  const [currentDate, setCurrentDate] = useState(new Date());

  // Inline editing state inside detail modal
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editEmotion, setEditEmotion] = useState<'happy' | 'sad' | 'calm' | 'tired' | 'angry'>('calm');
  const [editSentiment, setEditSentiment] = useState(5.0);
  const [isUpdating, setIsUpdating] = useState(false);

  // Manual past-date diary creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createEmotion, setCreateEmotion] = useState<'happy' | 'sad' | 'calm' | 'tired' | 'angry'>('calm');
  const [createSentiment, setCreateSentiment] = useState(5.0);
  const [isSavingNewDiary, setIsSavingNewDiary] = useState(false);

  useEffect(() => {
    // Verify authenticated session and load archive logs
    async function verifyAndLoadArchive() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          loadRealArchive();
        } else {
          logger.warn('Unauthenticated access attempt to archive gallery. Redirecting to landing.');
          router.push('/');
        }
      } catch (err) {
        logger.error('Failed to verify active authentication session on archive startup', err);
        router.push('/');
      }
    }
    verifyAndLoadArchive();
  // WHY: router is stable (Next.js guarantee). safe to include.
  }, [router]);

  /**
   * Loads all active user diary entries from Supabase PostgreSQL.
   */
  const loadRealArchive = async () => {
    try {
      const { data: dbDiaries, error } = await supabase
        .from('diaries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (dbDiaries) {
        setDiaries(dbDiaries.map((d: any) => ({
          id: d.id,
          session_id: d.session_id,
          title: d.title,
          content: d.content,
          emotion: d.emotion as 'happy' | 'sad' | 'calm' | 'tired' | 'angry',
          date: d.date,
          sentiment_score: Number(d.sentiment_score),
        })));
      }
    } catch (err) {
      logger.error('Failed to fetch database diaries archive', err);
      alert('일기 아카이브 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Commits an inline diary update securely utilizing our server-side proxy API.
   * 
   * WHY: Client-side Supabase keys lack direct table UPDATE permissions due to RLS limitations.
   * Server API proxies bypass these RLS barriers cleanly while maintaining absolute token verification.
   */
  const handleUpdateDiary = async () => {
    if (!selectedDiary) return;

    const trimmedTitle = editTitle.trim();
    const trimmedContent = editContent.trim();

    if (!trimmedTitle || !trimmedContent) {
      alert('일기 제목과 본문 내용을 모두 입력해 주세요.');
      return;
    }

    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Active session token expired.');

      const response = await fetch('/api/diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          diaryId: selectedDiary.id,
          title: trimmedTitle,
          content: trimmedContent,
          emotion: editEmotion,
          sentiment_score: editSentiment,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Server rejected diary update.');

      // Update local diaries cache state
      setDiaries(prev =>
        prev.map(d =>
          d.id === selectedDiary.id
            ? { ...d, title: trimmedTitle, content: trimmedContent, emotion: editEmotion, sentiment_score: editSentiment }
            : d
        )
      );

      // Synchronize active view details
      setSelectedDiary(prev =>
        prev ? { ...prev, title: trimmedTitle, content: trimmedContent, emotion: editEmotion, sentiment_score: editSentiment } : null
      );

      setIsEditing(false);
      logger.info(`Inline update completed for diary=${selectedDiary.id}`);
    } catch (err: any) {
      logger.error('Failed to execute inline diary update', err);
      alert(err.message || '일기 수정 도중 에러가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Commits a new manual diary entry for a specific calendar cell in the past.
   * 
   * WHY: Directly provisions an active completed chat session shell under the hood
   * to satisfy diaries FK requirements cleanly.
   */
  const handleCreateManualDiary = async () => {
    const trimmedTitle = createTitle.trim();
    const trimmedContent = createContent.trim();

    if (!trimmedTitle || !trimmedContent) {
      alert('일기 제목과 본문 내용을 모두 채워주세요.');
      return;
    }

    setIsSavingNewDiary(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Active session token expired.');

      const response = await fetch('/api/diary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          date: createDate,
          title: trimmedTitle,
          content: trimmedContent,
          emotion: createEmotion,
          sentiment_score: createSentiment,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Server rejected manual diary creation.');

      const newDiary: ArchiveDiary = {
        id: result.diary.id,
        session_id: result.diary.session_id,
        title: result.diary.title,
        content: result.diary.content,
        emotion: result.diary.emotion as 'happy' | 'sad' | 'calm' | 'tired' | 'angry',
        date: result.diary.date,
        sentiment_score: Number(result.diary.sentiment_score),
      };

      // Push into local diaries records
      setDiaries(prev => [newDiary, ...prev]);
      setIsCreateModalOpen(false);
      
      // Reset input form
      setCreateTitle('');
      setCreateContent('');
      setCreateEmotion('calm');
      setCreateSentiment(5.0);

      logger.info(`Manual calendar diary successfully created for date=${createDate}`);
    } catch (err: any) {
      logger.error('Failed to insert manual calendar diary entry', err);
      alert(err.message || '일기장 기록 도중 오류가 발생했습니다.');
    } finally {
      setIsSavingNewDiary(false);
    }
  };

  /**
   * Purges diary entries from local caches and Supabase PostgreSQL.
   */
  const handleDeleteDiary = async (diaryId: string) => {
    if (!confirm('정말로 이 일기를 아카이브에서 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
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
      setIsEditing(false);
      logger.info(`Permanently deleted database diary=${diaryId}`);
    } catch (err) {
      logger.error('Failed to delete database diary record', err);
      alert('일기 삭제 처리에 실패했습니다.');
    }
  };

  // Open detailing modal and populate form variables
  const handleOpenDetailModal = (diaryItem: ArchiveDiary) => {
    setSelectedDiary(diaryItem);
    setEditTitle(diaryItem.title);
    setEditContent(diaryItem.content);
    setEditEmotion(diaryItem.emotion);
    setEditSentiment(diaryItem.sentiment_score);
    setIsEditing(false);
    setActiveTab('diary');
    setChatMessages([]);
  };

  // Open blank creator modal pre-assigned with targeted date cell click
  const handleOpenCreateModal = (dateStr: string) => {
    setCreateDate(dateStr);
    setIsCreateModalOpen(true);
  };

  /**
   * Translates active emotion keys to appropriate emojis and visual themes.
   */
  const getEmotionMetadata = (emotion: string) => {
    switch (emotion) {
      case 'happy':
        return { emoji: '☀️', text: '기쁨', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10 glow-amber' };
      case 'sad':
        return { emoji: '🌧️', text: '슬픔', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10 glow-blue' };
      case 'calm':
        return { emoji: '🍃', text: '평온', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 glow-green' };
      case 'tired':
        return { emoji: '☕', text: '지침', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10 glow-purple' };
      case 'angry':
        return { emoji: '⚡', text: '속상', color: 'text-rose-300 border-rose-500/30 bg-rose-500/10 glow-red' };
      default:
        return { emoji: '🌙', text: '보통', color: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10 glow-indigo' };
    }
  };

  // ==========================================
  // MONTHLY GRID CALENDAR CALCULATION ENGINE
  // ==========================================
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get total days of targeted month and day starting offsets
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Navigate forward and backward across months safely
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build grid data representing monthly columns
  const calendarCells: { dateStr: string; dayNum: number; isPadding: boolean }[] = [];

  // Padding cells before the first day of targeted month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ dateStr: '', dayNum: 0, isPadding: true });
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    calendarCells.push({ dateStr, dayNum: d, isPadding: false });
  }

  // Padding cells at the end to make a neat grid multiple of 7
  const totalGridCells = Math.ceil(calendarCells.length / 7) * 7;
  const trailingPaddingCount = totalGridCells - calendarCells.length;
  for (let j = 0; j < trailingPaddingCount; j++) {
    calendarCells.push({ dateStr: '', dayNum: 0, isPadding: true });
  }

  // Map dates with existing diary logs
  const diaryByDateMap = new Map<string, ArchiveDiary>();
  diaries.forEach(d => {
    diaryByDateMap.set(d.date, d);
  });

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041a]">
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/10 to-indigo-800/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/10 to-blue-800/10 rounded-full blur-[120px] pointer-events-none" />

      {/* TOP HEADER BAR */}
      <header className="w-full max-w-4xl flex justify-between items-center z-10 mb-8 pb-4 border-b border-white/5 select-none">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>메인으로</span>
        </button>

        <h1 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-300" />
          <span>나의 밤의 일기장 회고첩</span>
        </h1>

        {/* View Mode Toggle Switch */}
        <div className="flex items-center gap-2 bg-slate-950/60 border border-white/5 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              viewMode === 'calendar' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>달력형</span>
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              viewMode === 'gallery' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>갤러리형</span>
          </button>
        </div>
      </header>

      {/* DYNAMIC VIEW CONTAINER */}
      <section className="w-full max-w-4xl z-10 flex-1 flex flex-col mb-12">
        {loading ? (
          <div className="text-center py-40 text-slate-500 text-xs flex-1 flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <span>회고 기록첩을 가지런히 정돈하는 중...</span>
          </div>
        ) : diaries.length === 0 && viewMode === 'gallery' ? (
          /* Empty state */
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 max-w-md mx-auto mt-10">
            <ShieldAlert className="w-12 h-12 text-purple-400/40 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-white mb-1.5">기록된 일기가 아직 없어요</h3>
            <p className="text-xs text-slate-400 leading-normal mb-6">
              밤하늘의 친구와 대화를 나누고 첫 일기장을 소중하게 아카이빙해 보세요!
            </p>
            <button
              onClick={() => router.push('/setup')}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors active:scale-[0.98] cursor-pointer"
            >
              첫 회고 대화 시작하기
            </button>
          </div>
        ) : viewMode === 'calendar' ? (
          
          /* 1. ACTUAL MONTHLY GRID CALENDAR VIEW */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Calendar Sub-Header Month Selector */}
            <div className="flex items-center justify-between mb-6 bg-slate-950/20 border border-white/5 rounded-2xl p-4 glass-panel">
              <button
                onClick={prevMonth}
                className="p-2 rounded-xl hover:bg-slate-950 border border-white/5 hover:border-purple-500/20 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <h2 className="text-sm font-extrabold text-white tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-300" />
                <span>{year}년 {month + 1}월</span>
              </h2>

              <button
                onClick={nextMonth}
                className="p-2 rounded-xl hover:bg-slate-950 border border-white/5 hover:border-purple-500/20 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar Grid Sheet */}
            <div className="glass-panel rounded-2xl sm:rounded-3xl border border-white/5 p-2 sm:p-4 bg-slate-950/20 flex-1 flex flex-col">
              
              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] font-extrabold text-slate-500 mb-3 uppercase tracking-wider pb-2 border-b border-white/5">
                <span className="text-red-400/80">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span className="text-blue-400/80">토</span>
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2.5 flex-1 min-h-[280px] sm:min-h-[360px]">
                {calendarCells.map((cell, idx) => {
                  if (cell.isPadding) {
                    return (
                      <div
                        key={`pad-${idx}`}
                        className="bg-transparent rounded-xl sm:rounded-2xl border border-transparent opacity-20 pointer-events-none"
                      />
                    );
                  }

                  const activeDiary = diaryByDateMap.get(cell.dateStr);
                  const isSunday = idx % 7 === 0;
                  const isSaturday = idx % 7 === 6;

                  if (activeDiary) {
                    const meta = getEmotionMetadata(activeDiary.emotion);
                    return (
                      <motion.div
                        key={`cell-${cell.dayNum}`}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => handleOpenDetailModal(activeDiary)}
                        className={`cursor-pointer rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 flex flex-col justify-between border relative overflow-hidden transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.2)] bg-purple-950/10 border-purple-500/25 hover:border-purple-400/60`}
                      >
                        {/* Day indicator */}
                        <div className="flex justify-between items-start z-10">
                          <span className={`text-[9px] sm:text-[10px] font-extrabold ${isSunday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-slate-300'}`}>
                            {cell.dayNum}
                          </span>
                          <span className="text-[9px] sm:text-[11px]">{meta.emoji}</span>
                        </div>

                        {/* Title thumbnail text */}
                        <h4 className="hidden sm:block text-[9px] font-bold text-white leading-tight line-clamp-2 mt-2 z-10 select-none">
                          {activeDiary.title}
                        </h4>

                        {/* Sentiment level dot highlight */}
                        <div className="flex justify-between items-center mt-1 sm:mt-2.5 pt-1 sm:pt-1.5 border-t border-white/5 z-10">
                          <span className="text-[7px] sm:text-[8px] font-semibold text-purple-300/80">
                            <span className="hidden sm:inline">Score </span>{activeDiary.sentiment_score.toFixed(1)}
                          </span>
                          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-purple-400 animate-pulse" />
                        </div>
                      </motion.div>
                    );
                  }

                  // Day without diary (displays + on hover)
                  return (
                    <motion.div
                      key={`cell-${cell.dayNum}`}
                      whileHover={{ scale: 1.02, border: '1px solid rgba(167, 139, 250, 0.25)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
                      onClick={() => handleOpenCreateModal(cell.dateStr)}
                      className="cursor-pointer rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 flex flex-col justify-between border border-white/5 bg-slate-950/10 text-left relative transition-all group"
                    >
                      <span className={`text-[9px] sm:text-[10px] font-extrabold ${isSunday ? 'text-red-500/50' : isSaturday ? 'text-blue-500/50' : 'text-slate-600'}`}>
                        {cell.dayNum}
                      </span>

                      {/* Micro-interaction '+' symbol appear on hover */}
                      <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 sm:mt-1">
                        <Plus className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-purple-400/80 animate-pulse" />
                      </div>

                      <span className="hidden sm:block text-[7px] font-bold text-slate-800 group-hover:text-purple-400/40 text-center select-none mt-1">
                        비어있음
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          
          /* 2. TRADITIONAL CARD GALLERY VIEW */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {diaries.map((diaryItem) => {
              const meta = getEmotionMetadata(diaryItem.emotion);
              return (
                <motion.div
                  key={diaryItem.id}
                  whileHover={{ y: -4 }}
                  onClick={() => handleOpenDetailModal(diaryItem)}
                  className="cursor-pointer glass-panel rounded-3xl p-5 border border-white/5 hover:border-purple-500/20 hover:shadow-[0_4px_25px_rgba(167,139,250,0.15)] transition-all flex flex-col justify-between h-44 bg-slate-950/20 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3 select-none">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        <span>{diaryItem.date}</span>
                      </div>
                      
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold border ${meta.color}`}>
                        {meta.emoji} {meta.text}
                      </span>
                    </div>

                    <h3 className="text-xs font-extrabold text-white mb-2 line-clamp-1">
                      {diaryItem.title}
                    </h3>

                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                      {diaryItem.content}
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-bold text-purple-300/80 border-t border-white/5 pt-2.5 mt-2">
                    <span>감정 밸런스: {diaryItem.sentiment_score.toFixed(1)}/10</span>
                    <span className="text-slate-500">더 보기 →</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* ==========================================
          DETAILED & INLINE EDIT MODAL EXPANSIONS
         ========================================== */}
      <AnimatePresence>
        {selectedDiary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`glass-panel-heavy rounded-2xl sm:rounded-3xl w-full p-5 sm:p-6 border border-purple-500/25 relative overflow-hidden transition-all duration-300 ${activeTab === 'chat' ? 'max-w-lg' : 'max-w-md'}`}
            >
              {/* Corner close button */}
              <button
                onClick={() => {
                  setSelectedDiary(null);
                  setIsEditing(false);
                }}
                disabled={isUpdating}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Date Header */}
              <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-extrabold mb-3 select-none">
                <Calendar className="w-4 h-4" />
                <span>{selectedDiary.date}의 밤의 회고첩</span>
              </div>

              {/* --------------------
                  INLINE VIEW MODE
                 -------------------- */}
              {!isEditing ? (
                <>
                  {/* Tab Selector Switch (Google Antigravity Premium) */}
                  <div className="flex bg-slate-950/60 border border-white/5 p-1 rounded-xl mb-4 select-none">
                    <button
                      onClick={() => handleTabChange('diary')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        activeTab === 'diary' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>📓 회고 일기</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('chat')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        activeTab === 'chat' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>💬 대화록 다시보기</span>
                    </button>
                  </div>

                  {activeTab === 'diary' ? (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getEmotionMetadata(selectedDiary.emotion).color}`}>
                          기분: {getEmotionMetadata(selectedDiary.emotion).emoji} {getEmotionMetadata(selectedDiary.emotion).text}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          감정지수: {selectedDiary.sentiment_score.toFixed(1)}/10
                        </span>
                      </div>

                      <div className="max-h-[45vh] sm:max-h-64 overflow-y-auto pr-1 select-text">
                        <h2 className="text-sm font-extrabold text-white mb-3 leading-snug">
                          "{selectedDiary.title}"
                        </h2>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line text-justify text-justify-inter-word font-semibold">
                          {selectedDiary.content}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Chat Replay Timeline */
                    <div className="max-h-[45vh] sm:max-h-64 overflow-y-auto pr-1 space-y-4 select-text">
                      {loadingChat ? (
                        <div className="text-center py-10 text-slate-500 text-[11px] flex flex-col items-center justify-center">
                          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                          <span>밤의 대화록을 불러오는 중...</span>
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-[11px]">
                          대화 없이 기록되었거나 대화 기록이 존재하지 않습니다.
                        </div>
                      ) : (
                        chatMessages.map((msg, mIdx) => {
                          const isAi = msg.sender === 'ai';
                          return (
                            <div key={msg.id || mIdx} className={`flex gap-2.5 items-end ${isAi ? 'justify-start' : 'justify-end'}`}>
                              {isAi && (
                                <div className="w-6 h-6 rounded-full shrink-0 bg-slate-900 border border-white/5 flex items-center justify-center text-[10px]">
                                  🌸
                                </div>
                              )}
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[11px] leading-relaxed font-medium ${
                                isAi
                                  ? 'bg-slate-950/60 border border-white/5 text-slate-200 rounded-tl-none'
                                  : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-tr-none border border-purple-400/20'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Actions (Edit / Delete) */}
                  <div className="flex gap-3 mt-6 border-t border-white/5 pt-4">
                    <button
                      onClick={() => handleDeleteDiary(selectedDiary.id)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900/60 hover:bg-red-950/20 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-900/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>일기 영구 삭제</span>
                    </button>

                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900/60 hover:bg-purple-950/20 text-slate-400 hover:text-purple-300 border border-slate-800 hover:border-purple-900/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>내용 수정하기</span>
                    </button>
                  </div>
                </>
              ) : (
                
                /* --------------------
                    INLINE EDIT MODE (Google Antigravity Premium)
                   -------------------- */
                <div className="flex flex-col gap-4">
                  {/* Emotion and score editor */}
                  <div className="flex flex-col gap-2.5 bg-slate-950/60 border border-white/5 rounded-2xl p-4">
                    <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                      오늘의 감정 무드 선택
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['happy', 'sad', 'calm', 'tired', 'angry'] as const).map(emoKey => {
                        const meta = getEmotionMetadata(emoKey);
                        return (
                          <button
                            key={emoKey}
                            type="button"
                            onClick={() => setEditEmotion(emoKey)}
                            className={`py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                              editEmotion === emoKey
                                ? 'bg-purple-600 border-purple-400 text-white shadow-sm'
                                : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="text-xs block">{meta.emoji}</span>
                            <span className="text-[8px] font-bold block">{meta.text}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Sentiment slider */}
                    <div className="mt-2.5 pb-1 border-t border-white/5 pt-2.5">
                      <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-slate-400">
                        <span>행복 점수 설정</span>
                        <span className="text-purple-300 font-extrabold">{editSentiment.toFixed(1)}/10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editSentiment}
                        onChange={(e) => setEditSentiment(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  </div>

                  {/* Title editor */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                      일기 제목
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="제목을 기입하세요..."
                      className="w-full h-11 rounded-xl px-4 text-xs glass-input font-bold border border-white/10 bg-slate-950/20"
                      maxLength={40}
                    />
                  </div>

                  {/* Content editor */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                      본문 내용
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="오늘 하루 기록을 자세하게 채워보세요..."
                      rows={6}
                      className="w-full rounded-2xl p-4 text-xs glass-input font-medium border border-white/10 bg-slate-950/20 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Edit Actions (Save, Cancel) */}
                  <div className="flex gap-3 mt-2 border-t border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      onClick={handleUpdateDiary}
                      disabled={isUpdating}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_15px_rgba(167,139,250,0.2)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isUpdating ? '저장 중...' : '변경사항 저장'}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MANUAL NEW DIARY CREATION MODAL OVERLAY
         ========================================== */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel-heavy rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 border border-purple-500/25 relative overflow-hidden"
            >
              {/* Corner close button */}
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSavingNewDiary}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Creator Header */}
              <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-extrabold mb-4 select-none">
                <Plus className="w-4 h-4" />
                <span>{createDate} 일기장 수동 추가</span>
              </div>

              {/* Creator Form fields */}
              <div className="flex flex-col gap-4">
                
                {/* Emotion Selector */}
                <div className="flex flex-col gap-2.5 bg-slate-950/60 border border-white/5 rounded-2xl p-4">
                  <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                    오늘의 감정 상태 설정
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['happy', 'sad', 'calm', 'tired', 'angry'] as const).map(emoKey => {
                      const meta = getEmotionMetadata(emoKey);
                      return (
                        <button
                          key={emoKey}
                          type="button"
                          onClick={() => setCreateEmotion(emoKey)}
                          className={`py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                            createEmotion === emoKey
                              ? 'bg-purple-600 border-purple-400 text-white shadow-sm'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="text-xs block">{meta.emoji}</span>
                          <span className="text-[8px] font-bold block">{meta.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sentiment range slider */}
                  <div className="mt-2.5 pb-1 border-t border-white/5 pt-2.5">
                    <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-slate-400">
                      <span>행복지수 피드백</span>
                      <span className="text-purple-300 font-extrabold">{createSentiment.toFixed(1)}/10</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={createSentiment}
                      onChange={(e) => setCreateSentiment(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                    오늘 한 줄 제목
                  </label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="오늘 하루를 관통하는 예쁜 제목을 지어주세요..."
                    className="w-full h-11 rounded-xl px-4 text-xs glass-input font-bold border border-white/10 bg-slate-950/20"
                    maxLength={40}
                  />
                </div>

                {/* Content text */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block">
                    본문 스토리 기술
                  </label>
                  <textarea
                    value={createContent}
                    onChange={(e) => setCreateContent(e.target.value)}
                    placeholder="오늘 밤 생각나는 속마음, 혹은 있었던 사소한 일화나 기승전결 이야기를 편안하게 채워보세요..."
                    rows={6}
                    className="w-full rounded-2xl p-4 text-xs glass-input font-medium border border-white/10 bg-slate-950/20 resize-none leading-relaxed"
                  />
                </div>

                {/* Creator Actions */}
                <div className="flex gap-3 mt-2 border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSavingNewDiary}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                  >
                    기입 취소
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateManualDiary}
                    disabled={isSavingNewDiary}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_15px_rgba(167,139,250,0.2)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingNewDiary ? '작성 완료 중...' : '새 일기장 기입'}</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
