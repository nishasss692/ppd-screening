import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PatientTopNav } from '../components/PatientTopNav.jsx';
import { PatientSidebar } from '../components/PatientSidebar.jsx';
import '../styles/patientLayout.css';

export function PatientLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`miora-app-shell patient-app-shell dash-enterprise-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#patient-main">
        Skip to patient content
      </a>

      {/* Persistent Left Sidebar Navigation */}
      <PatientSidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Workspace */}
      <div className="dash-enterprise-main patient-enterprise-main">
        <PatientTopNav onToggleMobile={() => setMobileNavOpen((prev) => !prev)} />
        <main id="patient-main" className="dash-main-scroll patient-content-area">
          <div className="miora-command-frame">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default PatientLayout;
