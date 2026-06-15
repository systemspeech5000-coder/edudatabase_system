import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { Header } from './components/Header';
import { StudentAssessment } from './components/StudentAssessment';
import { CoachDashboard } from './components/CoachDashboard';
import { FinanceDashboard } from './components/FinanceDashboard';
import { auth, isFirebaseConfigured } from './firebase';

type AppMode = 'select' | 'student' | 'teacherLogin' | 'teacher';
type AppTab = 'assessment' | 'dashboard' | 'finance';

function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('assessment');
  const [showConfigGuide, setShowConfigGuide] = useState(!isFirebaseConfigured);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [appMode, setAppMode] = useState<AppMode>('select');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherLoginError, setTeacherLoginError] = useState('');
  const [isTeacherLoginLoading, setIsTeacherLoginLoading] = useState(false);

  const teacherUid = import.meta.env.VITE_TEACHER_UID;
  const isTeacherAccount = !!user && !!teacherUid && user.uid === teacherUid;
  const isTeacherMode = appMode === 'teacher';

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (!currentUser) {
        setAppMode('select');
        setCurrentTab('assessment');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async () => {
    if (!auth) {
      alert('Firebase 설정이 필요합니다. Vercel 환경변수를 먼저 확인해주세요.');
      return;
    }

    if (!loginEmail || !loginPassword) {
      setLoginError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoginLoading(true);
    setLoginError('');

    try {
      const loggedInUser = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);

      if (teacherUid && loggedInUser.user.uid === teacherUid) {
        setAppMode('teacher');
        setCurrentTab('dashboard');
      } else {
        setAppMode('student');
        setCurrentTab('assessment');
      }

    } catch (error: any) {
      console.error('로그인 실패 코드:', error.code);
      console.error('로그인 실패 메시지:', error.message);

      if (error.code === 'auth/user-not-found') {
        setLoginError('등록되지 않은 이메일입니다. Firebase Users에 계정이 있는지 확인해주세요.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setLoginError('Firebase에서 Email/Password 로그인이 아직 활성화되지 않았습니다.');
      } else {
        setLoginError(`로그인 실패: ${error.code}`);
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleTeacherLogin = async () => {
    if (!user) return;

    if (!teacherUid || user.uid !== teacherUid) {
      setTeacherLoginError('등록된 교사 계정이 아닙니다.');
      return;
    }

    if (!teacherPassword) {
      setTeacherLoginError('교사 비밀번호를 입력해주세요.');
      return;
    }

    setIsTeacherLoginLoading(true);
    setTeacherLoginError('');

    try {
      await signInWithEmailAndPassword(auth!, user.email || '', teacherPassword);
      setAppMode('teacher');
      setCurrentTab('dashboard');
    } catch (error) {
      console.error(error);
      setTeacherLoginError('교사 비밀번호가 올바르지 않습니다.');
    } finally {
      setIsTeacherLoginLoading(false);
    }
  };


  const enterStudentMode = () => {
    setAppMode('student');
    setCurrentTab('assessment');
  };

  const openTeacherLogin = () => {
    setAppMode('teacherLogin');
    setCurrentTab('assessment');
    setLoginError('');
    setLoginPassword('');
    setTeacherPassword('');
    setTeacherLoginError('');
  };

  const exitTeacherMode = () => {
    setAppMode('student');
    setCurrentTab('assessment');
  };

  const goToFirstScreen = () => {
    setAppMode('select');
    setCurrentTab('assessment');
    setTeacherPassword('');
    setTeacherLoginError('');
  };

  if (isAuthLoading) {
    return (
      <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
        로그인 상태를 확인하는 중입니다...
      </div>
    );
  }

  if (!user) {
    if (appMode === 'teacherLogin') {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '860px',
              padding: '2.6rem 3.8rem',
              textAlign: 'center',
              borderRadius: '34px',
              background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 55%, #fdf2f8 100%)',
              border: '1.5px solid rgba(196, 181, 253, 0.7)',
              boxShadow: '0 28px 80px rgba(88, 28, 135, 0.18)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-70px',
                right: '-60px',
                width: '180px',
                height: '180px',
                borderRadius: '999px',
                background: 'rgba(216, 180, 254, 0.35)',
              }}
            />

            <div
              style={{
                position: 'absolute',
                bottom: '-80px',
                left: '-70px',
                width: '200px',
                height: '200px',
                borderRadius: '999px',
                background: 'rgba(251, 207, 232, 0.38)',
              }}
            />

            <div
              style={{
                width: '100%',
                maxWidth: '690px',
                margin: '0 auto',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                    fontSize: '1.8rem',
                    boxShadow: '0 14px 30px rgba(139, 92, 246, 0.28)',
                  }}
                >
                  👩‍🏫
                </div>

                <h1
                  className="welcome-title"
                  style={{
                    textAlign: 'center',
                    margin: 0,
                    fontSize: '1.65rem',
                    fontWeight: 950,
                    color: '#4c1d95',
                  }}
                >
                  교사 로그인
                </h1>

                <p
                  className="step-desc-text"
                  style={{
                    textAlign: 'center',
                    margin: '0.65rem 0 0 0',
                    fontSize: '0.95rem',
                    fontWeight: 650,
                    color: '#64748b',
                    lineHeight: 1.55,
                  }}
                >
                  교사용 모니터링 페이지에 접속합니다.
                </p>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.9rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.78)',
                    color: '#be185d',
                    fontSize: '0.86rem',
                    fontWeight: 900,
                    boxShadow: '0 8px 20px rgba(236, 72, 153, 0.12)',
                  }}
                >
                  🌷 오늘도 따뜻한 수업을 응원해요
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.6rem',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: '#4c1d95',
                      textAlign: 'left',
                    }}
                  >
                    교사 이메일
                  </label>

                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="교사 이메일 입력"
                    style={{
                      width: '100%',
                      height: '54px',
                      borderRadius: '17px',
                      border: '1.5px solid #ddd6fe',
                      background: '#ffffff',
                      padding: '0 1rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#334155',
                      outline: 'none',
                      boxSizing: 'border-box',
                      boxShadow: '0 8px 18px rgba(88, 28, 135, 0.06)',
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.6rem',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: '#4c1d95',
                      textAlign: 'left',
                    }}
                  >
                    교사 비밀번호
                  </label>

                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEmailLogin();
                      }
                    }}
                    placeholder="교사 비밀번호 입력"
                    style={{
                      width: '100%',
                      height: '54px',
                      borderRadius: '17px',
                      border: '1.5px solid #ddd6fe',
                      background: '#ffffff',
                      padding: '0 1rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#334155',
                      outline: 'none',
                      boxSizing: 'border-box',
                      boxShadow: '0 8px 18px rgba(88, 28, 135, 0.06)',
                    }}
                  />
                </div>

                {loginError && (
                  <p
                    style={{
                      color: 'hsl(350, 75%, 45%)',
                      fontWeight: 800,
                      margin: '-0.3rem 0 0 0',
                      fontSize: '0.9rem',
                      textAlign: 'left',
                    }}
                  >
                    {loginError}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  marginTop: '1.7rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEmailLogin}
                  disabled={isLoginLoading}
                  style={{
                    width: '220px',
                    height: '56px',
                    borderRadius: '18px',
                    fontSize: '1.05rem',
                    fontWeight: 950,
                    boxShadow: '0 14px 28px rgba(124, 58, 237, 0.26)',
                  }}
                >
                  {isLoginLoading ? '로그인 중...' : '교사 로그인'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAppMode('select')}
                  disabled={isLoginLoading}
                  style={{
                    width: '160px',
                    height: '56px',
                    borderRadius: '18px',
                    fontSize: '0.92rem',
                    fontWeight: 850,
                  }}
                >
                  돌아가기
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (appMode === 'student') {
      return (
        <>
          <Header
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            isTeacherMode={false}
            onLogout={() => {
              setAppMode('select');
              setCurrentTab('assessment');
            }}
            onExitTeacherMode={() => {
              setAppMode('select');
              setCurrentTab('assessment');
            }}
          />

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <StudentAssessment />
          </main>
        </>
      );
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="card animate-fade-in"
          style={{
            width: '100%',
            maxWidth: '900px',
            minHeight: '360px',
            padding: '2.75rem 2.8rem',
            textAlign: 'center',
            borderRadius: '34px',
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 55%, #fdf2f8 100%)',
            border: '1.5px solid rgba(196, 181, 253, 0.7)',
            boxShadow: '0 28px 80px rgba(88, 28, 135, 0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-70px',
              right: '-60px',
              width: '180px',
              height: '180px',
              borderRadius: '999px',
              background: 'rgba(216, 180, 254, 0.35)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-70px',
              width: '200px',
              height: '200px',
              borderRadius: '999px',
              background: 'rgba(251, 207, 232, 0.38)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem auto',
                fontSize: '2rem',
                boxShadow: '0 18px 36px rgba(139, 92, 246, 0.3)',
              }}
            >
              🎤
            </div>

            <h1
              className="welcome-title"
              style={{
                margin: 0,
                fontSize: '1.85rem',
                fontWeight: 950,
                color: '#4c1d95',
                letterSpacing: '-0.04em',
              }}
            >
              스피치 맞춤형 진단
            </h1>

            <p
              style={{
                margin: '0.55rem 0 0 0',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              이용할 모드를 선택해주세요.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))',
                gap: '1rem',
                marginTop: '1.45rem',
                marginBottom: '0.9rem',
              }}
            >
              <button
                type="button"
                onClick={enterStudentMode}
                style={{
                  border: 'none',
                  borderRadius: '24px',
                  padding: '1.05rem 1.25rem',
                  background: 'linear-gradient(135deg, #ede9fe, #f5f3ff)',
                  color: '#5b21b6',
                  fontSize: '1.25rem',
                  fontWeight: 950,
                  cursor: 'pointer',
                  boxShadow: '0 14px 28px rgba(124, 58, 237, 0.14)',
                }}
              >
                <div style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>🧑‍🎓</div>
                학생 입장
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: '0.92rem',
                    fontWeight: 750,
                    color: '#7c3aed',
                  }}
                >
                  진단 검사 시작하기
                </div>
              </button>

              <button
                type="button"
                onClick={openTeacherLogin}
                style={{
                  border: 'none',
                  borderRadius: '24px',
                  padding: '1.05rem 1.25rem',
                  background: 'linear-gradient(135deg, #fce7f3, #faf5ff)',
                  color: '#9d174d',
                  fontSize: '1.25rem',
                  fontWeight: 950,
                  cursor: 'pointer',
                  boxShadow: '0 14px 28px rgba(236, 72, 153, 0.14)',
                }}
              >
                <div style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>👩‍🏫</div>
                교사 입장
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: '0.92rem',
                    fontWeight: 750,
                    color: '#be185d',
                  }}
                >
                  모니터링 대시보드 보기
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appMode === 'select') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="card animate-fade-in"
          style={{
            width: '100%',
            maxWidth: '900px',
            minHeight: '360px',
            padding: '2.75rem 2.8rem',
            textAlign: 'center',
            borderRadius: '34px',
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 55%, #fdf2f8 100%)',
            border: '1.5px solid rgba(196, 181, 253, 0.7)',
            boxShadow: '0 28px 80px rgba(88, 28, 135, 0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-70px',
              right: '-60px',
              width: '180px',
              height: '180px',
              borderRadius: '999px',
              background: 'rgba(216, 180, 254, 0.35)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-70px',
              width: '200px',
              height: '200px',
              borderRadius: '999px',
              background: 'rgba(251, 207, 232, 0.38)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem auto',
                fontSize: '2rem',
                boxShadow: '0 18px 36px rgba(139, 92, 246, 0.3)',
              }}
            >
              🎤
            </div>

            <h1
              className="welcome-title"
              style={{
                margin: 0,
                fontSize: '1.85rem',
                fontWeight: 950,
                color: '#4c1d95',
                letterSpacing: '-0.04em',
              }}
            >
              스피치 맞춤형 진단
            </h1>

            <p
              style={{
                margin: '0.55rem 0 0 0',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              {user.email}님, 환영합니다.
              <br />
              이용할 모드를 선택해주세요.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isTeacherAccount ? '1fr 1fr' : '1fr',
                gap: '1rem',
                marginTop: '1.45rem',
                marginBottom: '0.9rem',
              }}
            >
              <button
                type="button"
                onClick={enterStudentMode}
                style={{
                  border: 'none',
                  borderRadius: '24px',
                  padding: '1.05rem 1.25rem',
                  background: 'linear-gradient(135deg, #ede9fe, #f5f3ff)',
                  color: '#5b21b6',
                  fontSize: '1.25rem',
                  fontWeight: 950,
                  cursor: 'pointer',
                  boxShadow: '0 14px 28px rgba(124, 58, 237, 0.14)',
                }}
              >
                <div style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>🧑‍🎓</div>
                학생 입장
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: '0.92rem',
                    fontWeight: 750,
                    color: '#7c3aed',
                  }}
                >
                  진단 검사 시작하기
                </div>
              </button>

              {isTeacherAccount && (
                <button
                  type="button"
                  onClick={openTeacherLogin}
                  style={{
                    border: 'none',
                    borderRadius: '24px',
                    padding: '1.05rem 1.25rem',
                    background: 'linear-gradient(135deg, #fce7f3, #faf5ff)',
                    color: '#9d174d',
                    fontSize: '1.25rem',
                    fontWeight: 950,
                    cursor: 'pointer',
                    boxShadow: '0 14px 28px rgba(236, 72, 153, 0.14)',
                  }}
                >
                  <div style={{ fontSize: '1.65rem', marginBottom: '0.25rem' }}>👩‍🏫</div>
                  교사 입장
                  <div
                    style={{
                      marginTop: '0.35rem',
                      fontSize: '0.92rem',
                      fontWeight: 750,
                      color: '#be185d',
                    }}
                  >
                    모니터링 대시보드 보기
                  </div>
                </button>
              )}
            </div>

            {!isTeacherAccount && (
              <p
                style={{
                  fontSize: '0.86rem',
                  color: '#64748b',
                  marginBottom: '1.2rem',
                  fontWeight: 700,
                }}
              >
                교사 계정이 아니므로 학생 입장만 가능합니다.
              </p>
            )}

          </div>
        </div>
      </div>
    );
  }

  if (appMode === 'teacherLogin') {
    return (
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '860px',
          margin: '3.2rem auto',
          padding: '2.8rem 3.8rem',
          borderRadius: '36px',
          background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 55%, #fdf2f8 100%)',
          border: '1.5px solid rgba(196, 181, 253, 0.7)',
          boxShadow: '0 30px 90px rgba(88, 28, 135, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-70px',
            right: '-60px',
            width: '180px',
            height: '180px',
            borderRadius: '999px',
            background: 'rgba(216, 180, 254, 0.35)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-70px',
            width: '200px',
            height: '200px',
            borderRadius: '999px',
            background: 'rgba(251, 207, 232, 0.38)',
          }}
        />

        <div
          style={{
            width: '100%',
            maxWidth: '690px',
            margin: '0 auto',
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                fontSize: '1.8rem',
                boxShadow: '0 14px 30px rgba(139, 92, 246, 0.28)',
              }}
            >
              👩‍🏫
            </div>

            <h1
              className="welcome-title"
              style={{
                textAlign: 'center',
                margin: 0,
                fontSize: '1.65rem',
                fontWeight: 950,
                color: '#4c1d95',
              }}
            >
              교사 모드 로그인
            </h1>

            <p
              className="step-desc-text"
              style={{
                textAlign: 'center',
                margin: '0.65rem 0 0 0',
                fontSize: '0.95rem',
                fontWeight: 650,
                color: '#64748b',
                lineHeight: 1.55,
              }}
            >
              교사 모드 접속을 위해 비밀번호를 한 번 더 입력해주세요.
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '0.9rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.78)',
                color: '#be185d',
                fontSize: '0.86rem',
                fontWeight: 900,
                boxShadow: '0 8px 20px rgba(236, 72, 153, 0.12)',
              }}
            >
              🌷 오늘도 따뜻한 수업을 응원해요
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.6rem',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: '#4c1d95',
                }}
              >
                교사 이메일
              </label>

              <input
                type="email"
                name="email"
                autoComplete="email"
                value={user.email || ''}
                disabled
                style={{
                  width: '100%',
                  height: '54px',
                  borderRadius: '17px',
                  border: '1.5px solid #ddd6fe',
                  background: '#f8fafc',
                  padding: '0 1rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#64748b',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 8px 18px rgba(88, 28, 135, 0.06)',
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.6rem',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: '#4c1d95',
                }}
              >
                교사 비밀번호
              </label>

              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTeacherLogin();
                  }
                }}
                placeholder="교사 비밀번호 입력"
                style={{
                  width: '100%',
                  height: '54px',
                  borderRadius: '17px',
                  border: '1.5px solid #ddd6fe',
                  background: '#ffffff',
                  padding: '0 1rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#334155',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 8px 18px rgba(88, 28, 135, 0.06)',
                }}
              />
            </div>

            {teacherLoginError && (
              <p
                style={{
                  color: 'hsl(350, 75%, 45%)',
                  fontWeight: 800,
                  margin: '-0.3rem 0 0 0',
                  fontSize: '0.9rem',
                }}
              >
                {teacherLoginError}
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.8rem',
              marginTop: '1.7rem',
            }}
          >
            <button
              type="button"
              className="btn btn-success"
              onClick={handleTeacherLogin}
              disabled={isTeacherLoginLoading}
              style={{
                width: '220px',
                height: '56px',
                borderRadius: '18px',
                fontSize: '1.05rem',
                fontWeight: 950,
                boxShadow: '0 14px 28px rgba(124, 58, 237, 0.26)',
              }}
            >
              {isTeacherLoginLoading ? '로그인 중...' : '교사 로그인'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAppMode('select')}
              disabled={isTeacherLoginLoading}
              style={{
                width: '160px',
                height: '44px',
                borderRadius: '16px',
                fontSize: '0.92rem',
                fontWeight: 850,
              }}
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isTeacherMode={isTeacherMode}
        onLogout={goToFirstScreen}
        onExitTeacherMode={exitTeacherMode}
      />

      {showConfigGuide && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            borderLeft: '4px solid hsl(14, 85%, 58%)',
            background: 'var(--bg-pastel-peach)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <h4
              style={{
                color: 'hsl(14, 80%, 25%)',
                marginBottom: '0.25rem',
                fontSize: '0.95rem',
                fontWeight: 'bold',
              }}
            >
              ℹ️ Firebase 설정이 등록되지 않아 임시 저장 모드(Demo Mode)로 열렸습니다.
            </h4>

            <p style={{ fontSize: '0.82rem', color: 'hsl(14, 80%, 35%)', fontWeight: '500' }}>
              진단 결과 및 상담 JPG 보고서는 브라우저에 임시로 저장되며, 이 컴퓨터 화면 안에서 자유롭게 테스트해 볼 수 있습니다.
              <br />
              실제 클라우드 데이터베이스에 연동하려면 프로젝트 폴더 루트에 <strong>.env.local</strong> 파일을 만들어 Firebase 키를 추가해 주세요.
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
              borderRadius: '6px',
            }}
          >
            안내 닫기
          </button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {isTeacherMode ? (
          currentTab === 'finance' ? (
            <FinanceDashboard />
          ) : (
            <CoachDashboard />
          )
        ) : (
          <StudentAssessment />
        )}
      </main>
    </>
  );
}

export default App;