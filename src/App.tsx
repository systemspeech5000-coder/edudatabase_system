import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

import { Header } from './components/Header';
import { StudentAssessment } from './components/StudentAssessment';
import { CoachDashboard } from './components/CoachDashboard';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

function App() {
  const [currentTab, setCurrentTab] = useState<'assessment' | 'dashboard'>('assessment');
  const [showConfigGuide, setShowConfigGuide] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const teacherUid = import.meta.env.VITE_TEACHER_UID;
  const isTeacher = !!user && !!teacherUid && user.uid === teacherUid;

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (!currentUser) {
        setHasEntered(false);
        setCurrentTab('assessment');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert('Firebase 설정이 필요합니다. Vercel 환경변수를 먼저 확인해주세요.');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert('Google 로그인 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    if (!auth) return;

    await signOut(auth);
    setUser(null);
    setHasEntered(false);
    setCurrentTab('assessment');
  };

  const enterStudent = () => {
    setCurrentTab('assessment');
    setHasEntered(true);
  };

  const enterTeacher = () => {
    setCurrentTab('dashboard');
    setHasEntered(true);
  };

  if (isAuthLoading) {
    return (
      <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
        로그인 상태를 확인하는 중입니다...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card animate-fade-in" style={{
        maxWidth: '520px',
        margin: '5rem auto',
        padding: '2.5rem',
        textAlign: 'center'
      }}>
        <h1 className="welcome-title">정서&스피치 모니터링</h1>
        <p className="step-desc-text" style={{ marginBottom: '1.5rem' }}>
          서비스를 이용하려면 Google 계정으로 로그인해주세요.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGoogleLogin}
        >
          Google 계정으로 로그인
        </button>

        {!isFirebaseConfigured && (
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'hsl(350, 75%, 45%)' }}>
            Firebase 설정이 등록되지 않았습니다. Vercel 환경변수를 확인해주세요.
          </p>
        )}
      </div>
    );
  }

  if (!hasEntered) {
    return (
      <div className="card animate-fade-in" style={{
        maxWidth: '560px',
        margin: '5rem auto',
        padding: '2.5rem',
        textAlign: 'center'
      }}>
        <h1 className="welcome-title">정서&스피치 모니터링</h1>

        <p style={{ marginBottom: '0.5rem', fontWeight: 700 }}>
          {user.displayName || user.email}님, 환영합니다.
        </p>

        <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          현재 UID: {user.uid}
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={enterStudent}
          >
            학생 입장
          </button>

          {isTeacher && (
            <button
              type="button"
              className="btn btn-success"
              onClick={enterTeacher}
            >
              교사 입장
            </button>
          )}
        </div>

        {!isTeacher && (
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            교사 계정이 아니므로 학생 입장만 가능합니다.
          </p>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={handleLogout}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <>
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isTeacher={isTeacher}
        userEmail={user.email}
        onLogout={handleLogout}
      />

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