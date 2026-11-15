import React from 'react';
import { Outlet } from 'react-router-dom';
import { PatientTopNav } from '../components/PatientTopNav.jsx';
import '../styles/patientLayout.css';

export function PatientLayout() {
  return (
    <div className="miora-app-shell patient-app-shell is-topnav-layout">
      <PatientTopNav />
      <main className="miora-command-shell patient-content-area" id="patient-main">
        <div className="miora-command-frame">
          {/* Signature ambient blush ribbon behind header CTA */}
          <svg
            className="miora-header-ribbon"
            viewBox="0 0 640 160"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="patientHeaderWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbdbe2" stopOpacity="0" />
                <stop offset="48%" stopColor="#f9cbd7" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#fce8ec" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path
              d="M0 140 C 160 135, 220 35, 390 42 C 510 46, 560 92, 640 30 L 640 160 L 0 160 Z"
              fill="url(#patientHeaderWaveGrad)"
            />
          </svg>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default PatientLayout;
