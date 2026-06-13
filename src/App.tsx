import { useState } from 'react';
import { Header } from './components/Header';
import { StudentAssessment } from './components/StudentAssessment';
import { CoachDashboard } from './components/CoachDashboard';
import { isFirebaseConfigured } from './firebase';

function App() {
  const [currentTab, setCurrentTab] = useState<'assessment' | 'dashboard'>('assessment');
  const [showConfigGuide, setShowConfigGuide] = useState(!isFirebaseConfigured);

  return (
    <>
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {showConfigGuide && (
        <div className="card animate-fade-in" style={{
          marginBottom: '1.5rem',
          borderLeft: '4px solid hsl(14, 85%, 58%)',
          background: 'var(--bg-pastel-peach)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'hsl(14, 80%, 25%)', marginBottom: '0.25rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
              ℹ️ Firebase 설정이 등록되지 않아 임시 저장 모드(Demo Mode)로 열렸습니다.
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'hsl(14, 80%, 35%)', fontWeight: '500' }}>
              진단 결과 및 상담 JPG 보고서는 브라우저에 임시로 저장되며, 이 컴퓨터 화면 안에서 자유롭게 테스트해 볼 수 있습니다.<br />
              실제 클라우드 데이터베이스에 연동하려면 프로젝트 폴더 루트에 <strong>.env.local</strong> 파일을 만들어 Firebase 키를 추가해 주세요. (가이드는 <strong>.env.example</strong> 참고)
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setShowConfigGuide(false)}
            style={{
              border: 'none',
              background: 'rgba(244, 63, 94, 0.1)',
              color: 'hsl(350, 75%, 45%)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px'
            }}
          >
            안내 닫기
          </button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'assessment' ? (
          <StudentAssessment />
        ) : (
          <CoachDashboard />
        )}
      </main>
    </>
  );
}

export default App;
