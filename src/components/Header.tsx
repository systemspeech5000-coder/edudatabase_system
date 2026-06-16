import React from 'react';
import { isFirebaseConfigured } from '../firebase';

type HeaderTab = 'assessment' | 'dashboard' | 'finance';

interface HeaderProps {
  currentTab: HeaderTab;
  setCurrentTab: (tab: HeaderTab) => void;
  isTeacherMode: boolean;
  onLogout: () => void;
  onExitTeacherMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  isTeacherMode,
  onLogout,
  onExitTeacherMode,
}) => {
  const handleLogoClick = () => {
    if (isTeacherMode) {
      setCurrentTab('dashboard');
      return;
    }

    setCurrentTab('assessment');
  };

  return (
    <header className="app-header">
      <div className="header-logo" onClick={handleLogoClick}>
        <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="logo-text-wrapper">
          <span className="logo-text">스피치 맞춤형 진단</span>
          <span className="logo-subtext">Emotion & Speech Monitor</span>
        </div>
      </div>

      <nav className="header-nav">
        {!isTeacherMode && (
          <button
            type="button"
            className={`nav-btn ${currentTab === 'assessment' ? 'active' : ''}`}
            onClick={() => setCurrentTab('assessment')}
          >
            <span className="nav-icon">✏️</span> 진단 작성하기
          </button>
        )}

        {isTeacherMode && (
          <>
            <button
              type="button"
              className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentTab('dashboard')}
            >
              <span className="nav-icon">✨</span> 상담 결과 통계
            </button>

            <button
              type="button"
              className={`nav-btn ${currentTab === 'finance' ? 'active' : ''}`}
              onClick={() => setCurrentTab('finance')}
            >
              <span className="nav-icon">💰</span> 비용 및 수입관리
            </button>
          </>
        )}
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

        {isTeacherMode && onExitTeacherMode && (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={onExitTeacherMode}
            style={{ marginLeft: '0.5rem' }}
          >
            학생 모드로
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onLogout}
          style={{ marginLeft: '0.5rem' }}
        >
          {isTeacherMode ? '로그아웃' : '처음으로'}
        </button>
      </div>
    </header>
  );
};
