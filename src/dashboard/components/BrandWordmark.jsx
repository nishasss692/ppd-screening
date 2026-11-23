import React from 'react';
import { AANCHAL_LOGO_PNG, AANCHAL_LOGO_DATA_URI } from '../../assets/brandAssets.js';

export function BrandWordmark({ className = '', height = 36 }) {
  return (
    <span
      className={`brand-wordmark ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
      }}
    >
      <img
        src={AANCHAL_LOGO_PNG}
        alt="AANCHAL — Caring for the One Who Cares for All"
        className="aanchal-official-logo"
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: 'auto',
          maxHeight: '48px',
          objectFit: 'contain',
          display: 'block',
        }}
        onError={(e) => {
          if (e.currentTarget.src !== AANCHAL_LOGO_DATA_URI) {
            e.currentTarget.src = AANCHAL_LOGO_DATA_URI;
          } else {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = 'inline-block';
            }
          }
        }}
      />
      <span
        style={{
          display: 'none',
          fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
          letterSpacing: '0.04em',
          fontWeight: 700,
          color: '#ba1e53',
        }}
      >
        AANCHAL
      </span>
    </span>
  );
}
