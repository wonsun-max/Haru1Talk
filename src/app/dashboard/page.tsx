'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MessageSquare, Mic, Sparkles, LogOut, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
}

/**
 * Haru Talk Central Navigation Dashboard.
 * 
 * WHY: Serves as the primary authenticated lobby (portal) where users can
 * access their Calendar Gallery archive, launch a tailored AI diary chat setup,
 * or instantly initiate an ultra-low latency hands-free Voice Call.
 */
export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isStartingLiveCall, setIsStartingLiveCall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Proactively verify the active authentication session on mount
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const defaultName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '하루톡 친구';
          setUserProfile({
            id: session.user.id,
            name: defaultName,
            avatar_url: session.user.user_metadata?.avatar_url,
          });
          logger.info('Dashboard: Auth session verified successfully.');
        } else {
          logger.warn('Dashboard: Unauthenticated access attempt. Redirecting to landing page.');
          window.location.href = '/';
        }
      } catch (err) {
        logger.error('Dashboard: Failed to verify authentication session on startup', err);
        window.location.href = '/';
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  /**
   * Destroys active session JWT tokens and signs the user out of the platform.
   * 
   * WHY: Revokes authenticated access securely and returns the client to the landing gate.
   */
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      logger.error('Dashboard: Failed to execute sign out transaction', err);
      window.location.href = '/';
    }
  };

  /**
   * Directly provisions an active chat session and redirects to live audio mode.
   * 
   * WHY: Seamlessly starts a session using their last saved persona (or warm_f)
   * without forcing extra configuration steps, maximizing hands-free immediacy.
   */
  const handleStartLiveVoiceCall = async () => {
    if (!userProfile) return;

    setIsStartingLiveCall(true);
    try {
      // 1. Fetch persona preferences from cache, fallback to warm_f
      const savedPersona = localStorage.getItem('haru_talk_persona') || 'warm_f';

      // 2. Direct database injection of a brand new active session
      const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userProfile.id,
          persona: savedPersona,
          status: 'chatting',
        })
        .select()
        .single();

      if (error || !sessionData) throw error;

      logger.info(`Dashboard: Provisioned live voice session=${sessionData.id} with persona=${savedPersona}`);
      
      // 3. Navigate straight to the chat room in live calling mode!
      window.location.href = `/chat/${sessionData.id}?mode=live`;
    } catch (err) {
      logger.error('Dashboard: Failed to provision direct voice call session', err);
      alert('음성 통화 세션을 개설하는 도중 에러가 발생했습니다. 테이블 설정을 확인해 주세요.');
      setIsStartingLiveCall(false);
    }
  };

  // Profile icon fallback initials generator
  const getInitial = (name: string) => name.charAt(0) || 'U';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#02020a] to-[#04041a]">
        <div className="text-center text-slate-500 text-xs">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <span>보안 대시보드를 구축하는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 relative overflow-hidden bg-gradient-to-b from-[#02020a] to-[#04041a]">
      {/* Background Ambient Orbs (Google Antigravity Premium) */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/10 to-indigo-800/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/10 to-blue-800/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10000ms]" />

      {/* Full screen active session creation overlay */}
      <AnimatePresence>
        {isStartingLiveCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-28 h-28 flex items-center justify-center mb-6">
              <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping duration-1500" />
              <div className="absolute inset-2 rounded-full border border-indigo-500/20 animate-pulse" />
              <Mic className="w-8 h-8 text-purple-300 animate-bounce" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">실시간 음성 연결 터널을 구축하고 있습니다</h3>
            <p className="text-[10px] text-slate-400">대화 상대의 마이크 주파수를 맞추는 중입니다. 잠시만 기다려 주세요...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <header className="w-full max-w-4xl flex justify-between items-center z-10 mb-12 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt="Profile"
              className="w-10 h-10 rounded-full border border-purple-500/20 shadow-md"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              {userProfile ? getInitial(userProfile.name) : 'U'}
            </div>
          )}
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">안녕히 주무셨나요?</p>
            <h2 className="text-sm font-bold text-white">{userProfile?.name}님, 환영합니다</h2>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-red-950/20 hover:text-red-300 text-slate-400 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>로그아웃</span>
        </button>
      </header>

      {/* Landing Center Title */}
      <section className="w-full max-w-4xl z-10 text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-300 text-[10px] font-bold mb-4"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>대화하는 AI 감성 일기장, 하루톡</span>
        </motion.div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight md:text-4xl">
          오늘 밤, 당신의 마음을 보살필<br />
          <span className="bg-gradient-to-r from-purple-300 via-indigo-200 to-blue-300 bg-clip-text text-transparent">세 가지 치유의 문</span>
        </h1>
        <p className="text-xs text-slate-400 mt-3 max-w-md mx-auto leading-relaxed">
          과거의 일기첩을 열어 추억하거나, 따뜻한 인공지능 친구와 대화를 나누고 손쉽게 감성 일기를 자동으로 처방받아 보세요.
        </p>
      </section>

      {/* Grid Dashboard Cards (Google Antigravity Premium) */}
      <section className="w-full max-w-4xl z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        
        {/* Portal 1: Calendar Archive */}
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => window.location.href = '/archive'}
          className="cursor-pointer glass-panel rounded-3xl p-6 border border-white/5 hover:border-purple-500/30 transition-all duration-300 flex flex-col justify-between h-[280px] bg-slate-950/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center mb-5 shadow-[0_0_15px_rgba(167,139,250,0.1)]">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">나의 밤의 일기장 회고첩</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              과거에 기록한 예쁘고 아련한 일기장들을 달력 및 카드 목록 형태로 모아보고 감정 통계를 돌아봅니다.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-purple-300 border-t border-white/5 pt-4 mt-4">
            <span>회고 기록 열기</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Portal 2: Standard AI Chat setup */}
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => window.location.href = '/setup'}
          className="cursor-pointer glass-panel rounded-3xl p-6 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 flex flex-col justify-between h-[280px] bg-slate-950/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center mb-5 shadow-[0_0_15px_rgba(129,140,248,0.1)]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">새로운 AI 대화 시작하기</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              지침 가득한 오늘 밤, 위로해줄 대화 상대(F 프렌드, T 프렌드, 반려견)를 취향에 맞춰 고르고 대화를 준비합니다.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300 border-t border-white/5 pt-4 mt-4">
            <span>대화방 개설하기</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Portal 3: Live Voice Call Mode */}
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={handleStartLiveVoiceCall}
          className="cursor-pointer glass-panel rounded-3xl p-6 border border-white/5 hover:border-rose-500/30 transition-all duration-300 flex flex-col justify-between h-[280px] bg-slate-950/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-center mb-5 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">실시간 음성 프리토킹</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              복잡한 타이핑 없이, 목소리 터치 한 번으로 AI와 실시간 hands-free 통화를 나누며 편하게 수다를 떨어보세요.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-rose-300 border-t border-white/5 pt-4 mt-4">
            <span>음성 통화 바로 연결</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>

      </section>

      {/* Footer copyright */}
      <footer className="w-full max-w-4xl z-10 text-center border-t border-white/5 pt-8 text-[10px] text-slate-500">
        <p>© 2026 Haru Talk Team. All rights reserved. Securely powered by Supabase PostgreSQL & OpenAI.</p>
      </footer>
    </main>
  );
}
