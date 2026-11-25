import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from './components/TopNav.jsx';
import { DashboardSidebar } from './components/DashboardSidebar.jsx';
import { AddMotherModal } from './components/AddMotherModal.jsx';

export function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`miora-app-shell dash-enterprise-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#dashboard-main">
        Skip to dashboard content
      </a>

      {/* Persistent Left Sidebar Navigation */}
      <DashboardSidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Workspace */}
      <div className="dash-enterprise-main">
        <TopNav onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />
        <main id="dashboard-main" className="dash-main-scroll">
          <Outlet />
        </main>
      </div>

      <AddMotherModal />
    </div>
  );
}

