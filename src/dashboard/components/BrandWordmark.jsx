import React from 'react';

export function BrandWordmark({ className = '' }) {
  return (
    <span
      className={`brand-wordmark ${className}`.trim()}
      style={{
        fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
        letterSpacing: '0.04em',
        fontWeight: 700,
      }}
    >
      AANCHAL
    </span>
  );
}
