'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, BookOpen, Lock } from 'lucide-react';
import { BADGE_META } from './BadgeUnlockModal';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDiaries: number;
  badges: string[];
}

interface StreakCardProps {
  streak: StreakData | null;
}

/** All possible badge keys in milestone order. */
const ALL_BADGE_KEYS = ['flame_3', 'star_7', 'moon_14', 'galaxy_30', 'legend_100'];

/**
 * Returns a dynamic color class set based on the current streak length.
 * WHY: Visual heat-map — the streak number literally glows hotter as it grows,
 * giving users a tangible sense of momentum.
 */
function getStreakHeat(streak: number): { text: string; glow: string; ring: string } {
  if (streak >= 30) return { text: 'text-purple-300', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.5)]', ring: 'border-purple-500/50' };
  if (streak >= 14) return { text: 'text-indigo-300', glow: 'shadow-[0_0_25px_rgba(99,102,241,0.4)]', ring: 'border-indigo-500/40' };
  if (streak >= 7)  return { text: 'text-yellow-300', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]', ring: 'border-yellow-500/40' };
  if (streak >= 3)  return { text: 'text-orange-300', glow: 'shadow-[0_0_18px_rgba(249,115,22,0.4)]', ring: 'border-orange-500/40' };
  return { text: 'text-slate-300', glow: '', ring: 'border-slate-700/40' };
}

/**
 * Dashboard streak + badge showcase card.
 *
 * WHY: Surfaces the user's journaling momentum and earned badges in a premium
 * glassmorphic card. The flame counter uses dynamic colour/glow to reward
 * consistent engagement. Locked badges are displayed greyscale with a lock
 * overlay to motivate future writing.
 */
export default function StreakCard({ streak }: StreakCardProps) {
  const [badgeTooltip, setBadgeTooltip] = useState<string | null>(null);

  if (!streak) return null;

  const heat = getStreakHeat(streak.currentStreak);
  const earnedSet = new Set(streak.badges);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full max-w-4xl z-10"
    >
      <div className="glass-panel rounded-3xl p-6 bg-slate-950/20 border border-white/5 hover:border-purple-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold text-white">나의 하루톡 여정</h2>
          </div>
          {streak.currentStreak >= 3 && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-300 font-bold"
            >
              🔥 On Fire
            </motion.span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Current streak — centrepiece */}
          <motion.div
            className={`col-span-1 flex flex-col items-center justify-center rounded-2xl p-4 bg-slate-950/40 border ${heat.ring} ${heat.glow} transition-all duration-500`}
            animate={streak.currentStreak > 0 ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <span className={`text-3xl font-black tabular-nums ${heat.text}`}>
              {streak.currentStreak}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">연속 기록</span>
          </motion.div>

          {/* Longest streak */}
          <div className="flex flex-col items-center justify-center rounded-2xl p-4 bg-slate-950/40 border border-white/5">
            <div className="flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-yellow-500" />
            </div>
            <span className="text-xl font-black text-slate-300 tabular-nums">{streak.longestStreak}</span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">최장 기록</span>
          </div>

          {/* Total diaries */}
          <div className="flex flex-col items-center justify-center rounded-2xl p-4 bg-slate-950/40 border border-white/5">
            <div className="flex items-center gap-1 mb-1">
              <BookOpen className="w-3 h-3 text-indigo-400" />
            </div>
            <span className="text-xl font-black text-slate-300 tabular-nums">{streak.totalDiaries}</span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">총 일기</span>
          </div>
        </div>

        {/* Badge gallery */}
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">획득 배지</p>
          <div className="flex items-center gap-3">
            {ALL_BADGE_KEYS.map((key) => {
              const meta = BADGE_META[key];
              const earned = earnedSet.has(key);

              return (
                <div key={key} className="relative flex flex-col items-center gap-1">
                  <motion.div
                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 cursor-default
                      ${earned
                        ? `bg-gradient-to-br ${meta.color} bg-opacity-20 border border-white/10 ${meta.glow}`
                        : 'bg-slate-900/60 border border-white/5 grayscale opacity-40'
                      }`}
                    whileHover={{ scale: 1.1 }}
                    onHoverStart={() => setBadgeTooltip(key)}
                    onHoverEnd={() => setBadgeTooltip(null)}
                    animate={earned ? { scale: [1, 1.04, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: ALL_BADGE_KEYS.indexOf(key) * 0.4 }}
                  >
                    {earned ? (
                      <span>{meta.icon}</span>
                    ) : (
                      <>
                        <span className="opacity-30">{meta.icon}</span>
                        <Lock className="w-3 h-3 text-slate-600 absolute bottom-1 right-1" />
                      </>
                    )}
                  </motion.div>
                  <span className="text-[9px] text-slate-600 text-center leading-tight w-12 truncate">{meta.name}</span>

                  {/* Tooltip on hover */}
                  {badgeTooltip === key && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-center whitespace-nowrap pointer-events-none"
                    >
                      <p className="text-white text-[11px] font-bold">{meta.icon} {meta.name}</p>
                      <p className="text-slate-400 text-[10px]">{meta.description}</p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Next milestone hint */}
        {(() => {
          const MILESTONES = [3, 7, 14, 30, 100];
          const next = MILESTONES.find((m) => m > streak.currentStreak);
          if (!next) return null;
          const remaining = next - streak.currentStreak;
          const progress = (streak.currentStreak / next) * 100;
          return (
            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-slate-500">다음 배지까지</span>
                <span className="text-[10px] text-purple-400 font-bold">앞으로 {remaining}일</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </motion.section>
  );
}
