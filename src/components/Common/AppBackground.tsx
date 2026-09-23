import React from 'react';

interface AppBackgroundProps {
  opacity?: number; // 0 to 1
  dimAmount?: 'light' | 'medium' | 'deep';
  className?: string;
  showPosterDetails?: boolean;
}

export default function AppBackground({
  opacity = 0.85,
  dimAmount = 'medium',
  className = '',
}: AppBackgroundProps) {
  const dimClasses = {
    light: 'bg-slate-950/50 backdrop-blur-[1px]',
    medium: 'bg-slate-950/70 backdrop-blur-[2px]',
    deep: 'bg-slate-950/85 backdrop-blur-[3px]',
  };

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}>
      {/* Background Graphic from User Uploaded Poster */}
      <img
        src="/bfp-app-bg.svg"
        alt="BFP Madrid Emergency Notifier Command and Citizen Response"
        className="w-full h-full object-cover object-top select-none transition-opacity duration-500"
        style={{ opacity }}
        referrerPolicy="no-referrer"
        loading="eager"
      />

      {/* Ambiance Glow Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/90 pointer-events-none" />

      {/* Darkened readability scrim */}
      <div className={`absolute inset-0 ${dimClasses[dimAmount]} pointer-events-none`} />
    </div>
  );
}
