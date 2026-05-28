'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Brain, Bone, Bell, ArrowRight, LogOut, Clock, User, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
}

/**
 * AI Companion Setup Panel.
 * 
 * WHY: Enables authenticated users to configure their chosen AI Persona
 * and daily notification preferences before starting a secure PostgreSQL
 * chat session record linked to their account.
 */
export default function SetupPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<'warm_f' | 'rational_t' | 'dog_c'>('warm_f');
  const [notificationTime, setNotificationTime] = useState('22:00');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Privacy Consent & Nickname states
  const [nickname, setNickname] = useState('');
  const [privacyConsented, setPrivacyConsented] = useState(false);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);

  useEffect(() => {
    // Proactively verify the active Supabase authentication session
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
          setNickname(defaultName);
          logger.info('Active Supabase user session loaded successfully.');
        } else {
          logger.warn('No active login session detected. Redirecting securely to landing page.');
          window.location.href = '/';
        }
      } catch (err) {
        logger.error('Failed to load authenticated user session during setup initialization', err);
        window.location.href = '/';
      }
    }
    loadUser();
  }, []);

  /**
   * Provisions a brand new chat session record directly in Supabase PostgreSQL.
   * 
   * WHY: Triggers an authenticated PostgreSQL insert to start a secure conversation thread,
   * obeying Row Level Security (RLS) policies.
   */
  const handleStartChat = async () => {
    if (!userProfile) return;
    
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      alert('사용하실 닉네임을 입력해 주세요.');
      return;
    }

    if (!privacyConsented) {
      alert('하루톡 서비스를 이용하시려면 개인정보 수집 및 음성 데이터 이용약관에 동의하셔야 합니다.');
      return;
    }

    setIsCreatingSession(true);
    setIsProfileUpdating(true);

    try {
      // 1. Sync custom nickname to Supabase Auth metadata securely
      const { error: profileError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedNickname,
          name: trimmedNickname,
        }
      });
      
      if (profileError) {
        logger.warn('Failed to sync auth user nickname metadata, proceeding to session creation', profileError);
      } else {
        logger.info('Auth user nickname metadata successfully synced.');
      }
      setIsProfileUpdating(false);

      // Save chosen settings to profile preferences local cache
      localStorage.setItem('haru_talk_persona', selectedPersona);
      localStorage.setItem('haru_talk_notif_time', notificationTime);

      // Real Supabase PostgreSQL session insert
      const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userProfile.id,
          persona: selectedPersona,
          status: 'chatting',
        })
        .select()
        .single();

      if (error || !sessionData) throw error;

      logger.info(`Provisioned active Supabase session=${sessionData.id}`);
      window.location.href = `/chat/${sessionData.id}`;
    } catch (err) {
      logger.error('Failed to create new chat session in Supabase PostgreSQL', err);
      setIsCreatingSession(false);
      setIsProfileUpdating(false);
      alert('세션 생성 도중 에러가 발생했습니다. Supabase 테이블 생성 및 RLS 정책을 점검해 주세요.');
    }
  };

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
      logger.error('Failed to execute sign out transaction', err);
      window.location.href = '/';
    }
  };

  // Profile icon fallback initials generator
  const getInitial = (name: string) => name.charAt(0) || 'U';

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 relative overflow-hidden">
      {/* Background Ambient Orbs (Google Antigravity Premium) */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/10 to-indigo-800/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/10 to-blue-800/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10000ms]" />

      {/* Navigation Header */}
      <header className="w-full max-w-lg flex justify-between items-center z-10 mb-8 pb-4 border-b border-white/5">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-red-950/20 hover:text-red-300 text-slate-400 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
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

        {/* NICKNAME EDIT FIELD */}
        <div className="glass-panel rounded-2xl p-5 mb-6 transition-all duration-300 hover:border-purple-500/20">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-300" />
            <span>나의 닉네임 설정</span>
          </label>
          <p className="text-[10px] text-slate-400 mb-3">AI 친구가 대화 중 당신을 친근하게 불러줄 이름입니다.</p>
          <div className="relative">
            <input
              id="nickname-input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="호칭을 입력해 주세요 (예: 원선, 쏭이)"
              className="w-full h-11 rounded-xl pl-4 pr-12 text-xs glass-input font-medium border border-white/10 bg-slate-950/20 focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/50 transition-all duration-300"
              maxLength={15}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500">
              {nickname.length}/15
            </span>
          </div>
        </div>

        {/* Persona Select Grid */}
        <div className="flex flex-col gap-4 mb-6">
          
          {/* Option 1: Warm F */}
          <motion.div
            onClick={() => setSelectedPersona('warm_f')}
            whileHover={{ scale: 1.01, y: -2 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'warm_f'
                ? 'glass-panel border-purple-500/60 shadow-[0_8px_32px_rgba(167,139,250,0.15)] bg-purple-950/20'
                : 'glass-panel bg-slate-950/10 border-white/5 hover:border-slate-700/60 hover:bg-slate-900/10'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
              selectedPersona === 'warm_f'
                ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(167,139,250,0.2)]'
                : 'bg-slate-900/60 border border-white/5 text-slate-400'
            }`}>
              <Heart className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">따뜻한 위로 F 프렌드</h3>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                  selectedPersona === 'warm_f'
                    ? 'bg-purple-400/10 text-purple-300 border-purple-400/20'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/40'
                }`}>공감형</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                당신의 감정에 깊이 공감하고 위로와 격려를 아끼지 않는 친구예요. 지치고 속상하거나 위로받고 싶을 때 가장 완벽한 짝이 되어 줍니다.
              </p>
            </div>
          </motion.div>

          {/* Option 2: Rational T */}
          <motion.div
            onClick={() => setSelectedPersona('rational_t')}
            whileHover={{ scale: 1.01, y: -2 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'rational_t'
                ? 'glass-panel border-blue-500/60 shadow-[0_8px_32px_rgba(56,189,248,0.15)] bg-blue-950/20'
                : 'glass-panel bg-slate-950/10 border-white/5 hover:border-slate-700/60 hover:bg-slate-900/10'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
              selectedPersona === 'rational_t'
                ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                : 'bg-slate-900/60 border border-white/5 text-slate-400'
            }`}>
              <Brain className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">명쾌한 조언 T 프렌드</h3>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                  selectedPersona === 'rational_t'
                    ? 'bg-blue-400/10 text-blue-300 border-blue-400/20'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/40'
                }`}>이성형</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                오늘 있었던 상황을 논리적으로 정리하고 생산적인 피드백이나 새로운 생각을 자극하는 명쾌한 솔루션을 제시하는 조언가 친구예요.
              </p>
            </div>
          </motion.div>

          {/* Option 3: Energetic Dog */}
          <motion.div
            onClick={() => setSelectedPersona('dog_c')}
            whileHover={{ scale: 1.01, y: -2 }}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex gap-4 ${
              selectedPersona === 'dog_c'
                ? 'glass-panel border-rose-500/60 shadow-[0_8px_32px_rgba(253,164,185,0.15)] bg-rose-950/20'
                : 'glass-panel bg-slate-950/10 border-white/5 hover:border-slate-700/60 hover:bg-slate-900/10'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
              selectedPersona === 'dog_c'
                ? 'bg-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(253,164,185,0.2)]'
                : 'bg-slate-900/60 border border-white/5 text-slate-400'
            }`}>
              <Bone className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">경청하는 멍멍이</h3>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                  selectedPersona === 'dog_c'
                    ? 'bg-rose-400/10 text-rose-300 border-rose-400/20'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/40'
                }`}>반려견</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                "멍! 왈!" 리액션과 함께 당신의 사소한 행동 하나도 꼬리를 흔들며 신나게 칭찬하는 귀여운 반려견 친구예요. 무거운 하루를 귀여움으로 정화해 줍니다.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Daily Alarm Notification card */}
        <div className="glass-panel rounded-2xl p-5 mb-6 flex items-center justify-between transition-all duration-300 hover:border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-center text-purple-300 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">오늘의 회고 푸시 알림</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">매일 밤 설정한 시각에 회고용 대화 알림을 보내드려요.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 border border-white/10 px-3 py-1.5 rounded-xl transition-all hover:border-purple-400/40 focus-within:border-purple-400/50">
            <Clock className="w-3.5 h-3.5 text-purple-300" />
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Privacy Consent Checkbox Card (Custom Checkbox) */}
        <div className="glass-panel rounded-2xl p-5 mb-8 transition-all duration-300 hover:border-purple-500/20">
          <button
            type="button"
            onClick={() => setPrivacyConsented(!privacyConsented)}
            className="flex items-start gap-3 text-left w-full cursor-pointer focus:outline-none"
          >
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300 mt-0.5 ${
              privacyConsented
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-400 text-white shadow-[0_0_10px_rgba(167,139,250,0.3)]'
                : 'border-white/10 bg-slate-950/40 hover:border-white/20'
            }`}>
              {privacyConsented && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
            </div>
            <div className="flex-1 select-none">
              <span className="text-xs font-bold text-white block">
                개인정보 수집 및 음성 데이터 이용약관 동의 (필수)
              </span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                하루톡은 AI 대화 피드백 제공, 실시간 음성 통화(STT/TTS) 연동, 그리고 밤의 일기장 생성을 목적으로 텍스트 및 음성 데이터를 수집하며, 이 데이터는 OpenAI 등 제3자 AI 모델 학습에 사용되지 않고 안전하게 암호화 보증 처리됩니다.
              </p>
            </div>
          </button>
        </div>

        {/* Submit Action Button */}
        <button
          id="setup-start-btn"
          onClick={handleStartChat}
          disabled={isCreatingSession || isProfileUpdating}
          className="w-full h-13 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold text-sm shadow-[0_4px_25px_rgba(167,139,250,0.25)] hover:shadow-[0_8px_30px_rgba(167,139,250,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 cursor-pointer"
        >
          {isCreatingSession ? (isProfileUpdating ? '프로필 동기화 중...' : '대화 세션 구성 중...') : '밤의 대화방으로 들어가기'}
          {!isCreatingSession && <ArrowRight className="w-4 h-4" />}
        </button>
      </section>
    </main>
  );
}
