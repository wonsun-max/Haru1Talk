'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Sparkles, MessageSquare, Calendar, Mic } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Haru Talk Landing and Live Authentication Gateway.
 * 
 * WHY: Acts as the primary security access barrier. Restricts entry solely
 * to authentic Cloud Supabase Auth sessions (supporting both Email/Password registrations
 * and OAuth integrations) with absolutely zero offline simulator bypasses.
 */
export default function LandingPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Production-only Email Authentication states
  const [authMethod, setAuthMethod] = useState<'oauth' | 'email'>('oauth');
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Proactively check and redirect if user session is already verified
    async function checkActiveSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          logger.info('Verified session active. Directing straight to companion setup.');
          window.location.href = '/setup';
        }
      } catch (err) {
        logger.error('Session acquisition failure on landing page initialization', err);
      }
    }
    checkActiveSession();
  }, []);

  /**
   * Triggers secure social OAuth flow (Google / Kakao) via Supabase.
   * 
   * WHY: delegates credential handshakes directly to trusted third parties, returning
   * authenticated web JWT profiles to the setup environment.
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
   * 
   * WHY: Authenticates existing client profiles securely in real-time, verifying passwords.
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
   * 
   * WHY: Instantiates fresh user identities in Supabase auth tables and registers nicknames.
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
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Floating Ambient Light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-10 right-10 w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        
        {/* Logo and Intro */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full glass-panel text-xs text-purple-300 font-semibold mb-6 animate-floating"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>쓰는 일기에서, 대화하는 일기로</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            id="main-title"
            className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4"
          >
            하루 톡 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-rose-300">Haru Talk</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-base text-slate-300 font-medium max-w-sm mx-auto leading-relaxed"
          >
            피곤한 하루의 끝, 친구와 카톡하듯 마음 편히 속마음을 말해보세요. AI가 완벽한 기승전결 일기로 요약해 드립니다.
          </motion.p>
        </div>

        {/* Dynamic Glass Panel for Action Form */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="glass-panel rounded-3xl p-8 relative overflow-hidden"
        >
          {/* Subtle star elements */}
          <div className="absolute top-4 right-6 text-purple-400/30 text-lg">★</div>
          <div className="absolute bottom-6 left-6 text-cyan-400/20 text-sm">✦</div>

          <h2 className="text-lg font-bold text-white text-center mb-6 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-purple-300" />
            <span>{authMethod === 'oauth' ? '보안 인증 및 간편 시작' : emailMode === 'login' ? '이메일 로그인' : '이메일 회원가입'}</span>
          </h2>

          <AnimatePresence mode="wait">
            {authMethod === 'oauth' ? (
              <motion.div
                key="oauth-panel"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
              >
                {/* Kakao Sign In Button */}
                <button
                  id="kakao-login-btn"
                  onClick={() => handleSocialLogin('kakao')}
                  disabled={isLoggingIn}
                  className="w-full h-13 rounded-2xl bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#191919] font-bold text-sm transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] shadow-[0_4px_20px_rgba(254,229,0,0.15)] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.53 1.69 4.753 4.2 5.903l-1.06 3.882c-.08.3.1.59.39.49l4.57-3.045c.3.04.6.065.9.065 4.97 0 9-3.185 9-7.11C21 6.185 16.97 3 12 3z" />
                  </svg>
                  <span>카카오톡으로 3초 만에 시작하기</span>
                </button>

                {/* Google Sign In Button */}
                <button
                  id="google-login-btn"
                  onClick={() => handleSocialLogin('google')}
                  disabled={isLoggingIn}
                  className="w-full h-13 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm transition-all duration-300 flex items-center justify-center gap-3 border border-slate-200 active:scale-[0.98] shadow-[0_4px_20px_rgba(255,255,255,0.08)] disabled:opacity-50 cursor-pointer"
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

                <div className="flex items-center my-2 text-slate-500 text-[11px] font-semibold font-sans">
                  <div className="flex-1 h-[1px] bg-slate-800" />
                  <span className="px-3">또는</span>
                  <div className="flex-1 h-[1px] bg-slate-800" />
                </div>

                {/* Switch to Email Button */}
                <button
                  type="button"
                  onClick={() => { setAuthMethod('email'); setErrorMessage(''); setSuccessMessage(''); }}
                  className="w-full h-11 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 text-purple-300 hover:text-white border border-purple-900/30 text-xs font-bold transition-all duration-300 active:scale-[0.98] cursor-pointer"
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
                {/* Email Login/Signup Tabs */}
                <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 mb-5">
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
                        placeholder="홍길동"
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
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-[0_4px_15px_rgba(147,51,234,0.2)]"
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

          {/* Privacy Assurance Statement */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <div className="flex gap-3 items-start">
              <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-purple-200 font-semibold mb-1">개인정보 및 안심 보안 정책</p>
                <p className="text-[11px] text-slate-400 leading-normal">
                  하루톡은 OpenAI API 기업용 정책을 사용하여, 유저의 대화 내용이 AI 학습에 절대 사용되지 않습니다. 대화 기록은 완벽히 암호화되어 안전하게 보관됩니다.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-panel rounded-2xl p-4 text-center"
          >
            <MessageSquare className="w-5 h-5 text-purple-300 mx-auto mb-2" />
            <p className="text-[11px] text-slate-300 font-semibold">감성 대화</p>
            <p className="text-[9px] text-slate-400 mt-1">3가지 MBTI 프렌드</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="glass-panel rounded-2xl p-4 text-center"
          >
            <Mic className="w-5 h-5 text-blue-300 mx-auto mb-2" />
            <p className="text-[11px] text-slate-300 font-semibold">음성 하이브리드</p>
            <p className="text-[9px] text-slate-400 mt-1">Whisper STT/TTS</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="glass-panel rounded-2xl p-4 text-center"
          >
            <Calendar className="w-5 h-5 text-rose-300 mx-auto mb-2" />
            <p className="text-[11px] text-slate-300 font-semibold">자동 아카이빙</p>
            <p className="text-[9px] text-slate-400 mt-1">감정 기반 분석 캘린더</p>
          </motion.div>
        </div>

        {/* Footnote */}
        <p className="text-center text-[10px] text-slate-500 mt-8">
          © 2026 Haru Talk. All rights reserved. Premium Nightly Diary.
        </p>
      </div>
    </main>
  );
}
