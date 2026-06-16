import React, { useState } from 'react';
import { db, storage, isFirebaseConfigured } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type StudentInfo, type SpeechScores, type ConsultationMemo, type SpeechType, type StudentRecord, SYMPTOM_CATEGORIES } from '../types';
import { generateConsultationMemoJpg } from '../utils/canvasGenerator';
declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: {
          roadAddress: string;
          jibunAddress: string;
          zonecode: string;
        }) => void;
      }) => {
        open: () => void;
      };
    };
  }
}
const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);

  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
};

type ExtendedStudentInfo = Omit<StudentInfo, 'birthDate'> & {
  gender: string;
  age: string;
};

export const StudentAssessment: React.FC = () => {
  const [studentName, setStudentName] = useState('');
  const [isNameConfirmed, setIsNameConfirmed] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submittedRecord, setSubmittedRecord] = useState<StudentRecord | null>(null);

  const [info, setInfo] = useState<ExtendedStudentInfo>({
    address: '',
    gender: '',
    age: '',
    visitRoute: '',
    contact: '',
    email: '',
  });
  const [emailId, setEmailId] = useState('');
  const [emailDomain, setEmailDomain] = useState('@gmail.com');
  const [customEmailDomain, setCustomEmailDomain] = useState('');

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [speechType, setSpeechType] = useState<SpeechType>('주도형');

  const [scores, setScores] = useState<SpeechScores>({
    contentAbility: 3,
    deliveryAbility: 5,
    interactionAbility: 3,
  });

  const [memo, setMemo] = useState<ConsultationMemo>({
    pastDifficulty: '',
    futureWorry: '',
    desiredState: '',
  });

  const handleNameConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (studentName.trim()) {
      setIsNameConfirmed(true);
    }
  };

  const handleSymptomToggle = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === 'contact') {
      nextValue = formatPhoneNumber(value);
    }

    setInfo((prev) => ({ ...prev, [name]: nextValue }));
  };
  const updateEmail = (
    nextEmailId: string,
    nextEmailDomain: string,
    nextCustomDomain = customEmailDomain
  ) => {
    const cleanedEmailId = nextEmailId.replace(/\s/g, '').replace(/@/g, '');

    const cleanedCustomDomain = nextCustomDomain
      ? `@${nextCustomDomain.replace(/\s/g, '').replace(/@/g, '')}`
      : '';

    const finalDomain =
      nextEmailDomain === 'custom' ? cleanedCustomDomain : nextEmailDomain;

    setEmailId(cleanedEmailId);
    setEmailDomain(nextEmailDomain);
    setCustomEmailDomain(nextCustomDomain);

    setInfo((prev) => ({
      ...prev,
      email: finalDomain ? `${cleanedEmailId}${finalDomain}` : '',
    }));
  };


  const handleAddressSearch = () => {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const selectedAddress = data.roadAddress || data.jibunAddress;

        setInfo((prev) => ({
          ...prev,
          address: selectedAddress,
        }));
      },
    }).open();
  };


  const handleScoreChange = (name: keyof SpeechScores, value: number) => {
    setScores((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMemo((prev) => ({ ...prev, [name]: value }));
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      return (
        info.address.trim() &&
        info.gender &&
        info.age &&
        info.contact.trim() &&
        info.email.trim() &&
        info.visitRoute
      );
    }


    if (currentStep === 5) {
      return memo?.pastDifficulty.trim() && memo?.futureWorry.trim() && memo?.desiredState.trim();
    }

    return true;
  };

  const getContentLabel = (val: number) => {
    if (val <= 1) return '😢 연습이 좀 더 필요해요';
    if (val <= 3) return '🙂 무난하게 작성할 수 있어요';
    return '🌟 조리 있게 아주 잘 써요!';
  };

  const getDeliveryLabel = (val: number) => {
    if (val <= 3) return '😢 발표할 때 떨리고 부끄러워요';
    if (val <= 7) return '🙂 크게 소리 낼 수 있어요';
    return '🌟 청중 앞에서도 자신감 백배!';
  };

  const getInteractionLabel = (val: number) => {
    if (val <= 1) return '😢 혼자 일방적으로 말하는 것 같아요';
    if (val <= 3) return '🙂 청중의 눈을 바라보며 얘기해요';
    return '🌟 모두를 내 이야기에 집중시켜요!';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setUploadProgress('상담 메모 이미지 생성 중...');

    try {
      const now = new Date();
      const dateString = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const jpgBlob = await generateConsultationMemoJpg(
        studentName,
        speechType,
        symptoms,
        scores,
        memo,
        dateString
      );

      let imageUrl = '';
      const filename = `memos/${studentName}_${Date.now()}.jpg`;

      if (isFirebaseConfigured && storage && db) {
        setUploadProgress('이미지 Cloud Storage 업로드 중...');
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, jpgBlob, { contentType: 'image/jpeg' });

        setUploadProgress('이미지 다운로드 URL 가져오는 중...');
        imageUrl = await getDownloadURL(storageRef);
      } else {
        imageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(jpgBlob);
        });
      }

      const record: StudentRecord & { gender: string; age: string } = {
        name: studentName,
        gender: info.gender,
        age: info.age,
        info: {
          ...info,
          birthDate: '',
        },
        symptoms,
        speechType,
        scores,
        memo,
        memoImageUrl: imageUrl,
        createdAt: now.toISOString(),
      };

      if (isFirebaseConfigured && db) {
        setUploadProgress('Firestore에 수강생 진단결과 등록 중...');
        const docRef = await addDoc(collection(db, 'students'), record);
        record.id = docRef.id;
      } else {
        const localData = localStorage.getItem('voxmonitor_students');
        const list = localData ? JSON.parse(localData) : [];
        record.id = `local_${Date.now()}`;
        list.push(record);
        localStorage.setItem('voxmonitor_students', JSON.stringify(list));
      }

      setSubmittedRecord(record);
      setUploadProgress('진단이 완료되었습니다!');
      setIsSuccess(true);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('진단 결과를 제출하는 동안 에러가 발생했습니다: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStudentName('');
    setIsNameConfirmed(false);
    setCurrentStep(1);
    setIsSuccess(false);
    setSymptoms([]);
    setSpeechType('주도형');
    setScores({ contentAbility: 3, deliveryAbility: 5, interactionAbility: 3 });
    setMemo({ pastDifficulty: '', futureWorry: '', desiredState: '' });
    setInfo({ address: '', gender: '', age: '', visitRoute: '', contact: '', email: '' });
    setEmailId('');
    setEmailDomain('@gmail.com');
    setCustomEmailDomain('');
  };

  if (!isNameConfirmed) {
    return (
      <div
        className="welcome-screen animate-fade-in"
        style={{
          minHeight: 'calc(100vh - 90px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '2.5rem 1.5rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="welcome-card card"
          style={{
            width: '100%',
            maxWidth: '760px',
            padding: '3.4rem 3.2rem',
            borderRadius: '38px',
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 55%, #fdf2f8 100%)',
            border: '1.5px solid rgba(196, 181, 253, 0.7)',
            boxShadow: '0 30px 90px rgba(88, 28, 135, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              right: '-70px',
              width: '210px',
              height: '210px',
              borderRadius: '999px',
              background: 'rgba(216, 180, 254, 0.36)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '-90px',
              left: '-80px',
              width: '230px',
              height: '230px',
              borderRadius: '999px',
              background: 'rgba(251, 207, 232, 0.42)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '30px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                fontSize: '2.6rem',
                boxShadow: '0 20px 42px rgba(139, 92, 246, 0.3)',
              }}
            >
              🎤
            </div>

            <div
              className="welcome-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.55rem 1rem',
                borderRadius: '999px',
                background: 'rgba(237, 233, 254, 0.9)',
                color: '#6d28d9',
                fontSize: '0.95rem',
                fontWeight: 900,
                marginBottom: '1rem',
              }}
            >
              🌱 스피치 진단 결과보기
            </div>

            <h1
              className="welcome-title"
              style={{
                margin: 0,
                fontSize: '2.25rem',
                fontWeight: 950,
                color: '#4c1d95',
                letterSpacing: '-0.04em',
              }}
            >
              스피치 자가 진단
            </h1>

            <p
              className="welcome-desc"
              style={{
                margin: '1rem 0 2rem 0',
                fontSize: '1.08rem',
                fontWeight: 700,
                color: '#64748b',
                lineHeight: 1.7,
              }}
            >
              나의 스피치 유형과 능력 상태를 가볍게 점검해 봐요.
              <br />
              이름을 입력하면 시작할 수 있습니다.
            </p>

            <form
              onSubmit={handleNameConfirm}
              className="welcome-form"
              style={{
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >
              <div
                className="input-group"
                style={{
                  textAlign: 'left',
                  marginBottom: '1.3rem',
                }}
              >
                <label
                  htmlFor="studentName"
                  style={{
                    display: 'block',
                    marginBottom: '0.65rem',
                    fontSize: '1.08rem',
                    fontWeight: 900,
                    color: '#4c1d95',
                  }}
                >
                  수강생 이름
                </label>

                <input
                  type="text"
                  id="studentName"
                  placeholder="이름을 알려주세요 (예: 김지우)"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    height: '60px',
                    borderRadius: '19px',
                    border: '1.5px solid #ddd6fe',
                    background: '#ffffff',
                    padding: '0 1.15rem',
                    fontSize: '1.08rem',
                    fontWeight: 750,
                    color: '#334155',
                    outline: 'none',
                    boxSizing: 'border-box',
                    boxShadow: '0 10px 22px rgba(88, 28, 135, 0.08)',
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large"
                style={{
                  width: '100%',
                  height: '60px',
                  borderRadius: '20px',
                  fontSize: '1.08rem',
                  fontWeight: 950,
                  boxShadow: '0 16px 32px rgba(124, 58, 237, 0.26)',
                }}
              >
                진단 시작하기 🚀
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess && submittedRecord) {
    const totalScore = scores.contentAbility + scores.deliveryAbility + scores.interactionAbility;
    const maxScore = 20;
    const pct = Math.round((totalScore / maxScore) * 100);

    return (
      <div className="success-screen animate-scale-in">
        <div className="success-card card text-center">
          <div className="success-icon">🎉</div>
          <h2 className="success-title">진단 결과 기록 완료!</h2>
          <p className="success-desc">
            <strong>{studentName}</strong> 님의 스피치 점수 체크가 안전하게 저장되었습니다.<br />
            하단의 보고서를 다운로드하거나 저장할 수 있습니다.
          </p>

          <div className="score-summary-circle">
            <svg viewBox="0 0 36 36" className="circular-chart indigo">
              <path
                className="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray={`${pct}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">{pct}%</text>
            </svg>

            <div className="score-label">
              종합 스피치 역량 점수: <span className="highlight">{totalScore}점</span> / 20점
            </div>
          </div>

          <div className="memo-preview-box">
            <h3>📂 나의 종합 상담 기록 문서 (JPG)</h3>
            <div className="memo-img-wrapper">
              <img src={submittedRecord.memoImageUrl} alt="상담 메모 JPG" className="memo-preview-img" />
            </div>
            <a
              href={submittedRecord.memoImageUrl}
              download={`${studentName}_상담메모.jpg`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-small"
            >
              💾 이미지 저장 주소로 보기
            </a>
          </div>

          <div className="success-actions">
            <button onClick={handleReset} className="btn btn-primary btn-medium">
              처음으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-wizard animate-fade-in">
      <div className="wizard-progress-bar">
        {[
          { step: 1, label: '인적사항' },
          { step: 2, label: '나의 증상' },
          { step: 3, label: '스피치 유형' },
          { step: 4, label: '스피치 점수' },
          { step: 5, label: '고민 메모' },
          { step: 6, label: '작성 검토' },
        ].map((s) => (
          <div
            key={s.step}
            className={`progress-step-item ${currentStep === s.step ? 'active' : ''} ${currentStep > s.step ? 'completed' : ''}`}
            onClick={() => s.step < currentStep && setCurrentStep(s.step)}
          >
            <div className="step-num">{s.step < currentStep ? '✓' : s.step}</div>
            <div className="step-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div
        className="wizard-content card"
        style={{
          width: '100%',
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '2.8rem 3.2rem',
          borderRadius: '32px',
        }}
      >
        <div className="wizard-header">
          <span className="student-badge">수강생: {studentName}</span>

          <h2 className="step-title">
            {currentStep === 1 && '✏️ 기본 기재사항을 채워주세요'}
            {currentStep === 2 && '🔍 발표할 때 내가 겪는 증상을 체크해봐요'}
            {currentStep === 3 && '🦁 테스트 버튼 클릭 후, 나의 스피치 유형을 선택해주세요'}
            {currentStep === 4 && '📊 테스트 버튼 클릭 후, 나의 스피치 능력 점수를 선택해주세요'}
            {currentStep === 5 && '📝 나의 발표 고민을 들려주세요'}
            {currentStep === 6 && '✅ 마지막으로 작성한 내용을 확인해봐요'}
          </h2>
        </div>

        {currentStep === 1 && (
          <div className="step-body animate-slide-up">
            <div
              className="form-grid"
              style={{
                gridTemplateColumns: 'minmax(220px, 4fr) minmax(0, 6fr)',
              }}
            >
              <div className="input-group">
                <label>연락처 *</label>
                <input
                  type="text"
                  name="contact"
                  inputMode="numeric"
                  placeholder="숫자만 입력해도 자동으로 표시돼요"
                  value={info.contact}
                  onChange={handleInfoChange}
                  maxLength={13}
                  required
                />

              </div>

              <div className="input-group">
                <label>이메일 주소 *</label>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="이메일 아이디"
                    value={emailId}
                    onChange={(e) => updateEmail(e.target.value, emailDomain)}
                    required
                    style={{ flex: 1, minWidth: '150px' }}
                  />

                  {emailDomain === 'custom' && (
                    <input
                      type="text"
                      placeholder="예: @kakao.com"
                      value={customEmailDomain}
                      onChange={(e) => updateEmail(emailId, 'custom', e.target.value)}
                      required
                      style={{ width: '180px' }}
                    />
                  )}

                  <select
                    value={emailDomain}
                    onChange={(e) => updateEmail(emailId, e.target.value)}
                    required
                    style={{ width: '160px' }}
                  >
                    <option value="@gmail.com">@gmail.com</option>
                    <option value="@naver.com">@naver.com</option>
                    <option value="@daum.net">@daum.net</option>
                    <option value="@hanmail.net">@hanmail.net</option>
                    <option value="custom">직접 입력</option>
                  </select>
                </div>
              </div>


              <div className="input-group">
                <label>성별 *</label>
                <select name="gender" value={info.gender} onChange={handleInfoChange} required>
                  <option value="">성별을 선택해주세요</option>
                  <option value="여자">여자</option>
                  <option value="남자">남자</option>
                </select>
              </div>

              <div className="input-group">
                <label>나이 *</label>
                <select name="age" value={info.age} onChange={handleInfoChange} required>
                  <option value="">나이를 선택해주세요</option>
                  <option value="10대">10대</option>
                  <option value="20대">20대</option>
                  <option value="30대">30대</option>
                  <option value="40대">40대</option>
                  <option value="50대">50대</option>
                  <option value="60대">60대</option>
                  <option value="70대">70대</option>
                </select>
              </div>

              <div className="input-group">
                <label>방문 경로 *</label>
                <select name="visitRoute" value={info.visitRoute} onChange={handleInfoChange} required>
                  <option value="">방문 경로를 선택해주세요</option>
                  <option value="인터넷 검색">인터넷 검색</option>
                  <option value="블로그">블로그</option>
                  <option value="유튜브">유튜브</option>
                  <option value="인스타">인스타</option>
                  <option value="지인 소개">지인 소개</option>
                  <option value="SNS광고">SNS광고</option>
                  <option value="간판/배너 광고">간판/배너 광고</option>
                  <option value="기타">기타</option>
                </select>

              </div>

              <div className="input-group">
                <label>주소(도로명이나 동까지) *</label>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    name="address"
                    placeholder="예: 서울시 관악구 낙성대동"
                    value={info.address}
                    onChange={handleInfoChange}
                    required
                    style={{ flex: 1, minWidth: 0 }}
                  />

                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="btn btn-secondary"
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '0 1rem',
                    }}
                  >
                    주소 검색
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-body animate-slide-up">
            <p className="step-desc-text">
              발표할 때 평소 느끼는 마음과 신체 반응을 선택해 주세요 (여러 개 선택 가능).
            </p>

            <div className="symptom-sections">
              <div className="symptom-category">
                <h3 className="category-title text-indigo">1. 내용구성 📝</h3>
                <div className="checkbox-list">
                  {SYMPTOM_CATEGORIES.content.map((sym) => (
                    <label key={sym} className={`checkbox-card ${symptoms.includes(sym) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={symptoms.includes(sym)}
                        onChange={() => handleSymptomToggle(sym)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="symptom-label">{sym}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="symptom-category">
                <h3 className="category-title text-purple">2. 표현 및 전달 🗣️</h3>
                <div className="checkbox-list">
                  {SYMPTOM_CATEGORIES.delivery.map((sym) => (
                    <label key={sym} className={`checkbox-card ${symptoms.includes(sym) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={symptoms.includes(sym)}
                        onChange={() => handleSymptomToggle(sym)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="symptom-label">{sym}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="symptom-category">
                <h3 className="category-title text-pink">3. 청중과 상호작용 👥</h3>
                <div className="checkbox-list">
                  {SYMPTOM_CATEGORIES.interaction.map((sym) => (
                    <label key={sym} className={`checkbox-card ${symptoms.includes(sym) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={symptoms.includes(sym)}
                        onChange={() => handleSymptomToggle(sym)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="symptom-label">{sym}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-body animate-slide-up">
            <p className="step-desc-text highlight-guide">
              📌 먼저 스피치 유형 테스트를 완료한 뒤, 결과에 맞는 스피치 유형을 선택해주세요.
            </p>

            <div className="speech-type-grid">
              {[
                {
                  type: '주도형' as SpeechType,
                  emoji: '🦁',
                  desc: '결과 중심 (주도형)',
                  details: '할 말을 빠르게 던지고 결론을 바로 말하는 솔직하고 강한 자신감이 돋보이는 타입이에요.',
                },
                {
                  type: '사교형' as SpeechType,
                  emoji: '🐬',
                  desc: '관계 중심 (사교형)',
                  details: '분위기를 밝게 만들고 재미있는 스토리로 모두를 공감하게 하는 친근한 소통 타입이에요.',
                },
                {
                  type: '안정형' as SpeechType,
                  emoji: '🕊️',
                  desc: '경청 중심 (안정형)',
                  details: '남의 말을 잘 귀 기울여 듣고 배려하며, 부드럽고 편안하게 말하는 따뜻한 대화 타입이에요.',
                },
                {
                  type: '신중형' as SpeechType,
                  emoji: '🦉',
                  desc: '사실 중심 (신중형)',
                  details: '정확한 사실과 준비된 내용, 꼼꼼한 정보들을 순서대로 조근조근 말하는 든든한 신뢰 타입이에요.',
                },
              ].map((item) => (
                <div
                  key={item.type}
                  className={`speech-type-card ${speechType === item.type ? 'active' : ''}`}
                  onClick={() => setSpeechType(item.type)}
                >
                  <div className="type-card-badge">{item.type}</div>
                  <div className="type-card-emoji">{item.emoji}</div>
                  <h3 className="type-card-title">{item.desc}</h3>
                  <p className="type-card-details">{item.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="step-body animate-slide-up">
            <p className="important-guide-box">
              📌 먼저 스피치 능력 테스트를 완료한 뒤, 나온 점수를 입력해주세요.
            </p>

            <div className="sliders-container">
              <div className="slider-group">
                <div className="slider-meta">
                  <span className="slider-title">내용 구성능력 (주제 짜기, 순서 배치)</span>
                  <span className="slider-score-value">{scores.contentAbility}점 / 5점</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={scores.contentAbility}
                  onChange={(e) => handleScoreChange('contentAbility', Number(e.target.value))}
                  className="accent-indigo"
                />

                <div className="slider-labels">
                  <span>미흡 (0점)</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                    {getContentLabel(scores.contentAbility)}
                  </span>
                  <span>우수 (5점)</span>
                </div>
              </div>

              <div className="slider-group">
                <div className="slider-meta">
                  <span className="slider-title">표현 및 전달능력 (목소리 크기, 발음, 자세)</span>
                  <span className="slider-score-value">{scores.deliveryAbility}점 / 10점</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={scores.deliveryAbility}
                  onChange={(e) => handleScoreChange('deliveryAbility', Number(e.target.value))}
                  className="accent-purple"
                />

                <div className="slider-labels">
                  <span>미흡 (0점)</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                    {getDeliveryLabel(scores.deliveryAbility)}
                  </span>
                  <span>우수 (10점)</span>
                </div>
              </div>

              <div className="slider-group">
                <div className="slider-meta">
                  <span className="slider-title">청중과 상호작용 (반응 살피기, 집중 이끌기)</span>
                  <span className="slider-score-value">{scores.interactionAbility}점 / 5점</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={scores.interactionAbility}
                  onChange={(e) => handleScoreChange('interactionAbility', Number(e.target.value))}
                  className="accent-pink"
                />

                <div className="slider-labels">
                  <span>미흡 (0점)</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                    {getInteractionLabel(scores.interactionAbility)}
                  </span>
                  <span>우수 (5점)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="step-body animate-slide-up">
            <p className="step-desc-text">
              발표와 대화에 대한 나의 깊은 마음 속 고민이나 바라는 모습을 편하게 적어봐요.
            </p>

            <div className="memos-form">
              <div className="input-group textarea-group">
                <label>Q1. 과거 발표와 관련해 어려움을 느꼈던 경험 *</label>
                <textarea
                  name="pastDifficulty"
                  placeholder="예: 초등학교 때 친구들 앞에서 대본을 읽다가 목소리가 떨려 얼굴이 엄청 빨개졌던 경험이 있어요."
                  value={memo?.pastDifficulty}
                  onChange={handleMemoChange}
                  required
                />
              </div>

              <div className="input-group textarea-group">
                <label>Q2. 앞으로의 발표에서 가장 걱정되는 부분 *</label>
                <textarea
                  name="futureWorry"
                  placeholder="예: 다음 주 학교 수행평가 발표 때 갑자기 외운 대본이 생각 안 나서 가만히 서 있게 될까 봐 걱정돼요."
                  value={memo?.futureWorry}
                  onChange={handleMemoChange}
                  required
                />
              </div>

              <div className="input-group textarea-group">
                <label>Q3. 발표에서 원하는 이미지나 상태 *</label>
                <textarea
                  name="desiredState"
                  placeholder="예: 떨리지 않고 차분하게 내 생각을 전달하면서, 친구들도 흥미롭게 귀 기울이는 밝고 당당한 이미지가 되고 싶어요."
                  value={memo?.desiredState}
                  onChange={handleMemoChange}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="step-body animate-slide-up">
            <p className="step-desc-text">
              마지막으로 아래 요약된 진단 결과가 맞는지 한번 꼼꼼히 훑어봐요.
            </p>

            <div className="review-dashboard">
              <div className="review-block">
                <h3>📋 기본 사항</h3>

                <table className="review-table">
                  <tbody>
                    <tr>
                      <th>수강생 성명</th>
                      <td>{studentName}</td>
                    </tr>
                    <tr>
                      <th>연락처</th>
                      <td>{info.contact}</td>
                    </tr>
                    <tr>
                      <th>이메일 주소</th>
                      <td>{info.email}</td>
                    </tr>
                    <tr>
                      <th>성별</th>
                      <td>{info.gender}</td>
                    </tr>
                    <tr>
                      <th>나이</th>
                      <td>{info.age}</td>
                    </tr>
                    <tr>
                      <th>방문 경로</th>
                      <td>{info.visitRoute}</td>
                    </tr>
                    <tr>
                      <th>주소</th>
                      <td>{info.address}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="review-block">
                <h3>🎯 유형 및 평가</h3>

                <table className="review-table">
                  <tbody>
                    <tr>
                      <th>스피치 유형</th>
                      <td><span className="tag type-tag">{speechType}</span></td>
                    </tr>
                    <tr>
                      <th>내용 구성</th>
                      <td>{scores.contentAbility} / 5점</td>
                    </tr>
                    <tr>
                      <th>표현 전달</th>
                      <td>{scores.deliveryAbility} / 10점</td>
                    </tr>
                    <tr>
                      <th>상호 작용</th>
                      <td>{scores.interactionAbility} / 5점</td>
                    </tr>
                    <tr className="total-row">
                      <th>종합 총점</th>
                      <td>
                        <strong>{scores.contentAbility + scores.deliveryAbility + scores.interactionAbility}</strong> / 20점
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <h4 style={{ marginBottom: '12px' }}>📊 스피치 역량 분포</h4>

                  <svg width="260" height="220" viewBox="0 0 260 220">
                    <polygon
                      points="130,25 230,175 30,175"
                      fill="#f8fafc"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                    />

                    <line x1="130" y1="125" x2="130" y2="25" stroke="#cbd5e1" />
                    <line x1="130" y1="125" x2="230" y2="175" stroke="#cbd5e1" />
                    <line x1="130" y1="125" x2="30" y2="175" stroke="#cbd5e1" />

                    <polygon
                      points={`
                        ${130},${125 - 100 * (scores.contentAbility / 5)}
                        ${130 + 100 * 0.866 * (scores.deliveryAbility / 10)},${125 + 50 * (scores.deliveryAbility / 10)}
                        ${130 - 100 * 0.866 * (scores.interactionAbility / 5)},${125 + 50 * (scores.interactionAbility / 5)}
                      `}
                      fill="rgba(139, 92, 246, 0.25)"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                    />

                    <text x="130" y="16" textAnchor="middle" fontSize="12" fill="#1e293b">
                      내용구성 {scores.contentAbility}/5
                    </text>
                    <text x="238" y="190" textAnchor="end" fontSize="12" fill="#1e293b">
                      표현전달 {scores.deliveryAbility}/10
                    </text>
                    <text x="22" y="190" textAnchor="start" fontSize="12" fill="#1e293b">
                      상호작용 {scores.interactionAbility}/5
                    </text>
                  </svg>
                </div>
              </div>

              <div className="review-block full-width">
                <h3>⚠️ 체크된 스피치 증상 ({symptoms.length}개)</h3>

                {symptoms.length > 0 ? (
                  <div className="symptoms-summary-tags">
                    {symptoms.map((sym) => (
                      <span key={sym} className="symptom-summary-tag">✓ {sym}</span>
                    ))}
                  </div>
                ) : (
                  <p className="no-symptoms-text">체크한 증상이 없어요.</p>
                )}
              </div>

              <div className="review-block full-width">
                <h3>📝 상담 메모</h3>

                <table className="review-table">
                  <tbody>
                    <tr>
                      <th>과거 발표와 관련해 어려움을 느꼈던 경험</th>
                      <td>{memo?.pastDifficulty || '입력된 내용이 없습니다.'}</td>
                    </tr>
                    <tr>
                      <th>앞으로의 발표에서 가장 걱정되는 부분</th>
                      <td>{memo?.futureWorry || '입력된 내용이 없습니다.'}</td>
                    </tr>
                    <tr>
                      <th>발표에서 원하는 이미지나 상태</th>
                      <td>{memo?.desiredState || '입력된 내용이 없습니다.'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="wizard-footer">
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={isSubmitting}
            >
              ⬅️ 이전 단계
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNameConfirmed(false)}
              disabled={isSubmitting}
            >
              이름 바꾸기
            </button>
          )}

          {(currentStep === 3 || currentStep === 4) && (
            <button
              type="button"
              className="btn btn-primary test-important-btn"
              onClick={() => window.open('https://eduproject-liard.vercel.app/', '_blank')}
              disabled={isSubmitting}
              style={{
                minWidth: '320px',
                height: '58px',
                borderRadius: '18px',
                fontSize: '1.08rem',
                fontWeight: 950,
                padding: '0 1.6rem',
                boxShadow: '0 14px 28px rgba(124, 58, 237, 0.26)',
              }}
            >
              {currentStep === 3 ? '🚀 스피치 유형 테스트 하러가기' : '🚀 스피치 능력 테스트 하러가기'}
            </button>
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={!isStepValid()}
            >
              다음 단계 ➡️
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '업로드 중...' : '💾 진단 완료 및 저장'}
            </button>
          )}
        </div>
      </div>

      {isSubmitting && (
        <div className="overlay">
          <div className="loader-card card text-center">
            <div className="spinner"></div>
            <h3>나의 소중한 스피치 진단 파일 저장 중...</h3>
            <p className="loader-status">{uploadProgress}</p>
          </div>
        </div>
      )}
    </div>
  );
};