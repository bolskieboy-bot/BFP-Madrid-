import React, { useState } from 'react';

interface BfpMadridLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  withGlow?: boolean;
  alt?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-20 h-20',
};

export default function BfpMadridLogo({
  className = '',
  size = 'md',
  withGlow = false,
  alt = 'BFP Madrid Fire Station - Bureau of Fire Protection',
  onClick,
}: BfpMadridLogoProps) {
  // Sources to try in order:
  // 1. User uploaded image asset
  // 2. Public SVG emblem
  // 3. Public PNG emblem
  const [srcIndex, setSrcIndex] = useState(0);

  const sources = [
    '/bfp-app-icon.svg',
    '/app-logo.svg',
    '/bfp-madrid-logo.svg',
    '/app-logo.png',
    'ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    '/bfp-madrid-logo.png',
  ];

  const handleError = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    }
  };

  const dimensionClass = SIZE_MAP[size] || 'w-10 h-10';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${withGlow ? 'drop-shadow-[0_0_12px_rgba(220,38,38,0.5)]' : ''} ${className}`}
    >
      <img
        src={sources[srcIndex]}
        alt={alt}
        onError={handleError}
        className={`${dimensionClass} object-contain rounded-full transform transition hover:scale-105`}
        loading="eager"
        draggable={false}
      />
    </div>
  );
}
