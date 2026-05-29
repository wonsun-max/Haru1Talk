'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

export interface WeeklyLetter {
  id: string;
  week_start: string;
  subject: string;
  content: string;
  avg_sentiment: number | null;
  dominant_emotion: string | null;
  diary_count: number;
  created_at: string;
}

interface WeeklyLetterCardProps {
  letter: WeeklyLetter | null;
}

/** Maps emotion keys to their localised display labels and colours. */
const EMOTION_META: Record<string, { label: string; color: string; icon: string }> = {
  happy:  { label: '행복', color: 'text-yellow-400',  icon: '😊' },
  sad:    { label: '슬픔', color: 'text-blue-400',    icon: '🌧️' },
  calm:   { label: '평온', color: 'text-emerald-400', icon: '🌙' },
  tired:  { label: '피로', color: 'text-slate-400',   icon: '😴' },
  angry:  { label: '분노', color: 'text-red-400',     icon: '🌩️' },
};

/**
 * Collapsible weekly AI letter card for the dashboard.
 *
 * WHY: The letter is the emotional centrepiece of the week — it deserves
 * a premium reveal pattern. We show a 2-line preview by default and let
 * users unfold the full letter with a smooth height animation, mirroring
 * the "opening an envelope" metaphor.
 */
export default function WeeklyLetterCard({ letter }: WeeklyLetterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!letter) return null;

  const emotion = letter.dominant_emotion ? EMOTION_META[letter.dominant_emotion] : null;

  // Format week_start as "5월 4주차" style label
  const weekStartDate = new Date(letter.week_start);
  const month = weekStartDate.getMonth() + 1;
  const weekOfMonth = Math.ceil(weekStartDate.getDate() / 7);
  const weekLabel = `${month}월 ${weekOfMonth}주차`;

  // Split content into preview (first ~80 chars) and rest
  const previewLength = 90;
  const hasMore = letter.content.length > previewLength;
  const previewText = hasMore ? letter.content.slice(0, previewLength) + '…' : letter.content;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl z-10"
    >
      <div className="glass-panel rounded-3xl overflow-hidden bg-slate-950/20 border border-purple-500/15 hover:border-purple-500/30 shadow-[0_8px_40px_rgba(168,85,247,0.08)] transition-all duration-300">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(167,139,250,0.15)]">
              <Mail className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{weekLabel} 주간 편지</p>
              <h3 className="text-sm font-bold text-white leading-snug">{letter.subject}</h3>
            </div>
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-2 shrink-0">
            {emotion && (
              <span className={`hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 border border-white/5 font-bold ${emotion.color}`}>
                {emotion.icon} {emotion.label}
              </span>
            )}
            {letter.avg_sentiment !== null && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 border border-white/5 text-indigo-300 font-bold">
                <TrendingUp className="w-2.5 h-2.5" />
                {Number(letter.avg_sentiment).toFixed(1)}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 border border-white/5 text-slate-400 font-semibold">
              📓 {letter.diary_count}편
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent mb-4" />

        {/* Letter preview / full content */}
        <div className="px-6 pb-5">
          <AnimatePresence initial={false} mode="wait">
            {isExpanded ? (
              <motion.p
                key="full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-slate-300 text-[13px] leading-relaxed whitespace-pre-wrap font-light"
              >
                {letter.content}
              </motion.p>
            ) : (
              <motion.p
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-slate-400 text-[13px] leading-relaxed"
              >
                {previewText}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Expand / collapse toggle */}
          {hasMore && (
            <motion.button
              onClick={() => setIsExpanded((v) => !v)}
              className="mt-3 flex items-center gap-1 text-purple-400 hover:text-purple-300 text-[11px] font-bold transition-colors cursor-pointer"
              whileTap={{ scale: 0.96 }}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  편지 접기
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  편지 전체 읽기
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Bottom glow bar */}
        <div className="h-0.5 bg-gradient-to-r from-purple-600/40 via-indigo-500/40 to-transparent" />
      </div>
    </motion.section>
  );
}
