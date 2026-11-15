import React from 'react';
import { Outlet } from 'react-router-dom';
import { PatientTopNav } from '../components/PatientTopNav.jsx';
import '../styles/patientLayout.css';

export function PatientLayout() {
  return (
    <div className="patient-app-shell is-topnav-layout">
      <PatientTopNav />
      <div className="patient-main-container">
        <main className="patient-content-area" id="patient-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default PatientLayout;

