import React from 'react';
import { isFirebaseConfigured } from '../firebase';

interface HeaderProps {
  currentTab: 'assessment' | 'dashboard';
  setCurrentTab: (tab: 'assessment' | 'dashboard') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <header className="app-header">
      <div className="header-logo" onClick={() => setCurrentTab('assessment')}>
        <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="logo-text-wrapper">
          <span className="logo-text"> 맞춤형 스피치 관리</span>
          <span className="logo-subtext">Speech Monitor</span>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-btn ${currentTab === 'assessment' ? 'active' : ''}`}
          onClick={() => setCurrentTab('assessment')}
        >
          <span className="nav-icon">✏️</span> 진단 작성하기
        </button>
        <button
          className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentTab('dashboard')}
        >
          <span className="nav-icon">✨</span> 나의 지난 결과
        </button>
      </nav>

      <div className="header-status">
        {isFirebaseConfigured ? (
          <span className="status-badge connected">
            <span className="status-dot"></span>
            클라우드 데이터 연동
          </span>
        ) : (
          <span className="status-badge demo">
            <span className="status-dot"></span>
            로컬 데모 모드 작동
          </span>
        )}
      </div>
    </header>
  );
};
