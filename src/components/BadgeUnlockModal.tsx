'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Maps badge keys to their display metadata. */
export const BADGE_META: Record<string, { icon: string; name: string; description: string; color: string; glow: string }> = {
  flame_3: {
    icon: '🔥',
    name: '새벽의 불꽃',
    description: '3일 연속 일기를 썼어요',
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.4)]',
  },
  star_7: {
    icon: '⭐',
    name: '별빛 일주일',
    description: '7일 연속 일기를 썼어요',
    color: 'from-yellow-400 to-amber-500',
    glow: 'shadow-[0_0_40px_rgba(234,179,8,0.4)]',
  },
  moon_14: {
    icon: '🌙',
    name: '달빛 두 주',
    description: '14일 연속 일기를 썼어요',
    color: 'from-indigo-400 to-violet-600',
    glow: 'shadow-[0_0_40px_rgba(129,140,248,0.5)]',
  },
  galaxy_30: {
    icon: '🌌',
    name: '우주의 항해자',
    description: '30일 연속 일기를 썼어요',
    color: 'from-purple-500 to-indigo-700',
    glow: 'shadow-[0_0_50px_rgba(168,85,247,0.5)]',
  },
  legend_100: {
    icon: '👑',
    name: '하루톡 전설',
    description: '100일 연속 일기를 썼어요',
    color: 'from-yellow-300 via-amber-400 to-yellow-600',
    glow: 'shadow-[0_0_60px_rgba(253,224,71,0.6)]',
  },
};

/** Generates random confetti particle positions for the burst effect. */
function generateConfetti(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 8 + 4,
    color: ['#a855f7', '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#f97316'][Math.floor(Math.random() * 6)],
    delay: Math.random() * 0.5,
    duration: Math.random() * 1.5 + 1,
  }));
}

const CONFETTI = generateConfetti(60);

interface BadgeUnlockModalProps {
  /** Badge key (e.g. 'flame_3'). Pass null to hide the modal. */
  badgeKey: string | null;
  onClose: () => void;
}

/**
 * Full-screen confetti + badge zoom-in modal for milestone unlocks.
 *
 * WHY: A purely decorative reward moment — triggered only when /api/summarize
 * returns a non-null newBadge in the streak payload. The Framer Motion
 * orchestration uses staggered children so the confetti bursts before
 * the badge card enters, maximising the "wow" factor.
 */
export default function BadgeUnlockModal({ badgeKey, onClose }: BadgeUnlockModalProps) {
  const badge = badgeKey ? BADGE_META[badgeKey] : null;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!badge) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [badge, onClose]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          key="badge-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Confetti burst layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {CONFETTI.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: '110vh', x: `${p.x}vw`, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [`110vh`, `${p.y}vh`],
                  rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                }}
                transition={{ delay: p.delay, duration: p.duration, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  left: `${p.x}%`,
                }}
              />
            ))}
          </div>

          {/* Badge card */}
          <motion.div
            key="badge-modal-card"
            initial={{ scale: 0, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative mx-4 max-w-xs w-full rounded-3xl p-8 text-center
              bg-gradient-to-b from-[#0d0d1f] to-[#07071a]
              border border-white/10 ${badge.glow}`}
          >
            {/* Animated ring behind icon */}
            <div className="relative mx-auto mb-5 w-24 h-24 flex items-center justify-center">
              <motion.div
                className={`absolute inset-0 rounded-full bg-gradient-to-tr ${badge.color} opacity-20`}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              />
              <motion.div
                className={`absolute inset-0 rounded-full border-2 border-white/10`}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
              />
              <span className="text-5xl relative z-10">{badge.icon}</span>
            </div>

            {/* Header text */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[11px] font-bold uppercase tracking-widest text-purple-400 mb-2"
            >
              🎉 배지 획득!
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`text-2xl font-extrabold bg-gradient-to-r ${badge.color} bg-clip-text text-transparent mb-2`}
            >
              {badge.name}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-slate-400 text-xs mb-6"
            >
              {badge.description}
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all cursor-pointer"
            >
              확인
            </motion.button>

            {/* Auto-dismiss progress bar */}
            <motion.div
              className={`absolute bottom-0 left-0 h-0.5 rounded-b-3xl bg-gradient-to-r ${badge.color}`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
