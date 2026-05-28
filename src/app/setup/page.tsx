'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, Heart, Brain, Bone, Bell, ArrowRight, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
}

/**
 * AI Companion Setup Page.
 * 
 * WHY: Enables users to configure their preferred AI Persona
 * ('warm_f', 'rational_t', 'dog_c') and daily push notification hour
 * before provisioning a database chat session record.
 */
export default function SetupPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<'warm_f' | 'rational_t' | 'dog_c'>('warm_f');
  const [notificationTime, setNotificationTime] = useState('22:00');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    async function loadUser() {
      // 1. Try to load active real Supabase session first
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Real session is active. Proactively clean lingering mock tokens to prevent confusion.
          localStorage.removeItem('haru_talk_mock_auth');
          setUserProfile({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '하루톡 친구',
            avatar_url: session.user.user_metadata?.avatar_url,
          });
          setIsMock(false);
          logger.info('Active Supabase user session loaded for setup.');
          return;
        }
      } catch (err) {
        logger.error('Failed to retrieve real user session on setup', err);
      }

      // 2. Fallback to simulated local mock credentials if present
      const mockAuth = localStorage.getItem('haru_talk_mock_auth');
      if (mockAuth) {
        const parsed = JSON.parse(mockAuth);
        setUserProfile({
          id: parsed.id,
          name: parsed.name,
          avatar_url: parsed.avatar_url,
        });
        setIsMock(true);
        logger.info('Mock session loaded for setup page.');
        return;
      }

      // 3. No active session of any kind. Redirect to landing.
      logger.warn('No active session. Redirecting to landing page.');
      window.location.href = '/';
    }
    loadUser();
  }, []);

  /**
   * provisions a new chat session (Supabase row or Mock storage)
   * and routes the client directly into the conversation environment.
   */
  const handleStartChat = async () => {
    setIsCreatingSession(true);
    
    // Save chosen settings to profile preferences local cache
    localStorage.setItem('haru_talk_persona', selectedPersona);
    localStorage.setItem('haru_talk_notif_time', notificationTime);

    if (isMock) {
      // Generate a mock uuid and mock session record
      const mockSessionId = `mock-session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const mockSession = {
        id: mockSessionId,
        user_id: userProfile?.id || 'mock-user',
        persona: selectedPersona,
        status: 'chatting',
        created_at: new Date().toISOString(),
      };
      
      const existingSessions = JSON.parse(localStorage.getItem('haru_talk_mock_sessions') || '[]');
      existingSessions.push(mockSession);
      localStorage.setItem('haru_talk_mock_sessions', JSON.stringify(existingSessions));
      
      // Initialize an empty messages array for this session
      localStorage.setItem(`haru_talk_mock_msgs_${mockSessionId}`, JSON.stringify([]));

      logger.info(`Provisioned simulated session=${mockSessionId}`);
      window.location.href = `/chat/${mockSessionId}`;
      return;
    }

    try {
      // Real Supabase insert
      const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userProfile?.id,
          persona: selectedPersona,
          status: 'chatting',
        })
        .select()
        .single();

      if (error || !sessionData) throw error;

      logger.info(`Provisioned active Supabase session=${sessionData.id}`);
      window.location.href = `/chat/${sessionData.id}`;
    } catch (err) {
      logger.error('Failed to create new chat session in Supabase', err);
      setIsCreatingSession(false);
      alert('세션 생성 도중 에러가 발생했습니다. Supabase 테이블 생성 및 RLS 정책을 점검해 주세요.');
    }
  };

  /**
   * Destroys active credentials cache and logs user out.
   */
  const handleSignOut = async () => {
    localStorage.removeItem('haru_talk_mock_auth');
    if (!isMock) {
      await supabase.auth.signOut();
    }
    window.location.href = '/';
  };

  // Profile icon fallback generator
  const getInitial = (name: string) => name.charAt(0) || 'U';

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-10 left-10 w-[200px] h-[200px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[200px] h-[200px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="w-full max-w-lg flex justify-between items-center z-10 mb-8">
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
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">웰컴</p>
            <h2 className="text-sm font-bold text-white">{userProfile?.name}님</h2>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-red-950/20 hover:text-red-300 text-slate-400 border border-slate-800 text-xs font-semibold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>로그아웃</span>
        </button>
      </header>

      {/* Setup Form */}
      <section className="w-full max-w-lg z-10">
        
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-300" />
            <span>오늘의 AI 친구 설정</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">오늘 밤, 당신의 하루 이야기를 함께 나눌 대화 상대를 선택해 주세요.</p>
        </div>

        {/* Persona Select Grid */}
        <div className="flex flex-col gap-4 mb-8">
          
          {/* Option 1: Warm F */}
          <motion.div
            onClick={() => setSelectedPersona('warm_f')}
            whileHover={{ scale: 1.01 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'warm_f'
                ? 'glass-panel border-purple-400/50 shadow-[0_8px_32px_rgba(167,139,250,0.15)] bg-purple-950/10'
                : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              selectedPersona === 'warm_f' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'
            }`}>
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">따뜻한 위로 F 프렌드</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-300 font-semibold border border-purple-400/20">공감형</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                당신의 감정에 깊이 공감하고 위로와 격려를 아끼지 않는 친구예요. 지치고 속상하거나 위로받고 싶을 때 가장 완벽한 짝이 되어 줍니다.
              </p>
            </div>
          </motion.div>

          {/* Option 2: Rational T */}
          <motion.div
            onClick={() => setSelectedPersona('rational_t')}
            whileHover={{ scale: 1.01 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'rational_t'
                ? 'glass-panel border-blue-400/50 shadow-[0_8px_32px_rgba(56,189,248,0.15)] bg-blue-950/10'
                : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              selectedPersona === 'rational_t' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'
            }`}>
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">명쾌한 조언 T 프렌드</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-300 font-semibold border border-blue-400/20">이성형</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                오늘 있었던 상황을 논리적으로 정리하고 생산적인 피드백이나 새로운 생각을 자극하는 명쾌한 솔루션을 제시하는 조언가 친구예요.
              </p>
            </div>
          </motion.div>

          {/* Option 3: Energetic Dog */}
          <motion.div
            onClick={() => setSelectedPersona('dog_c')}
            whileHover={{ scale: 1.01 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'dog_c'
                ? 'glass-panel border-rose-400/50 shadow-[0_8px_32px_rgba(253,164,185,0.15)] bg-rose-950/10'
                : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              selectedPersona === 'dog_c' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-500'
            }`}>
              <Bone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">경청하는 멍멍이</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-400/10 text-rose-300 font-semibold border border-rose-400/20">반려견</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                "멍! 왈!" 리액션과 함께 당신의 사소한 행동 하나도 꼬리를 흔들며 신나게 칭찬하는 귀여운 반려견 친구예요. 무거운 하루를 귀여움으로 정화해 줍니다.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Daily Alarm Notification card */}
        <div className="glass-panel rounded-2xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">오늘의 회고 푸시 알림</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">매일 밤 설정한 시각에 회고용 대화 알림을 보내드려요.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Submit Action Button */}
        <button
          id="setup-start-btn"
          onClick={handleStartChat}
          disabled={isCreatingSession}
          className="w-full h-13 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold text-sm shadow-[0_4px_25px_rgba(167,139,250,0.25)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isCreatingSession ? '대화 세션 구성 중...' : '밤의 대화방으로 들어가기'}
          {!isCreatingSession && <ArrowRight className="w-4 h-4" />}
        </button>

        {isMock && (
          <p className="text-center text-[10px] text-purple-300/60 font-semibold mt-3">
            * 현재 로컬 체험(시뮬레이터) 모드로 동작 중입니다. 모든 대화 정보는 로컬스토리지에 저장됩니다.
          </p>
        )}
      </section>
    </main>
  );
}
