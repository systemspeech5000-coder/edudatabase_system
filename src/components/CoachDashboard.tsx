import React, { useEffect, useState } from 'react';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { type StudentRecord, SYMPTOM_CATEGORIES } from '../types';

export const CoachDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('전체');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load records
  const loadRecords = async (selectFirst = true) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && db) {
        const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const records: StudentRecord[] = [];
        querySnapshot.forEach((d) => {
          records.push({ id: d.id, ...d.data() } as StudentRecord);
        });
        setStudents(records);
        if (selectFirst && records.length > 0) {
          setSelectedStudent(records[0]);
        }
      } else {
        // Fallback to localStorage
        const localData = localStorage.getItem('voxmonitor_students');
        if (localData) {
          const records: StudentRecord[] = JSON.parse(localData);
          records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setStudents(records);
          if (selectFirst && records.length > 0) {
            setSelectedStudent(records[0]);
          }
        } else {
          setStudents([]);
        }
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(true);
  }, []);

  // Filter students based on search and selected categories
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedTypeFilter === '전체' || s.speechType === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  // Delete student record
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 님의 스피치 진단 기록을 화면에서 지울까요?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      if (isFirebaseConfigured && db) {
        await deleteDoc(doc(db, 'students', id));
      } else {
        const localData = localStorage.getItem('voxmonitor_students');
        if (localData) {
          const records: StudentRecord[] = JSON.parse(localData);
          const filtered = records.filter(r => r.id !== id);
          localStorage.setItem('voxmonitor_students', JSON.stringify(filtered));
        }
      }

      alert('기록이 안전하게 지워졌습니다.');
      const updatedStudents = students.filter(r => r.id !== id);
      setStudents(updatedStudents);

      if (updatedStudents.length > 0) {
        setSelectedStudent(updatedStudents[0]);
      } else {
        setSelectedStudent(null);
      }
    } catch (error) {
      console.error('Failed to delete student:', error);
      alert('삭제 도중 문제가 생겼어요.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="coach-dashboard-wrapper animate-fade-in">
      <div className="dashboard-main-grid">
        {/* Left Sidebar: Student List */}
        <div className="sidebar-card card">
          <div className="sidebar-controls">
            <h3 className="section-title">진단 기록 목록 📂</h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 내 이름 검색하기..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-row">
              <div className="filter-group">
                <label>나의 스피치 유형 필터</label>
                <select value={selectedTypeFilter} onChange={(e) => setSelectedTypeFilter(e.target.value)}>
                  <option value="전체">모든 유형</option>
                  <option value="주도형">🦁 주도형</option>
                  <option value="사교형">🐬 사교형</option>
                  <option value="안정형">🕊️ 안정형</option>
                  <option value="신중형">🦉 신중형</option>
                </select>
              </div>
            </div>
          </div>

          <div className="student-list-container">
            {loading ? (
              <div className="inner-loader">기록 불러오는 중... 🕊️</div>
            ) : filteredStudents.length === 0 ? (
              <div className="empty-list-state">저장된 진단 기록이 없어요.</div>
            ) : (
              <div className="student-list">
                {filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    className={`student-list-item ${selectedStudent?.id === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedStudent(s)}
                  >
                    <div className="item-name">{s.name}</div>
                    <div className="item-sub" style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span>
                      <span className={`tag type-tag ${s.speechType}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        {s.speechType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Selected Report View */}
        <div className="details-panel">
          {selectedStudent ? (
            <div className="details-card card animate-fade-in" key={selectedStudent.id}>
              <div className="details-header">
                <div>
                  <h2 style={{ fontSize: '1.45rem' }}>✨ {selectedStudent.name} 님의 스피치 진단 결과지</h2>
                  <span className={`tag type-tag large ${selectedStudent.speechType}`} style={{ marginTop: '0.5rem' }}>
                    {selectedStudent.speechType} 스타일
                  </span>
                </div>
                <button
                  onClick={() => selectedStudent.id && handleDelete(selectedStudent.id, selectedStudent.name)}
                  className="btn btn-danger btn-small"
                  disabled={isDeleting}
                >
                  기록 삭제 🗑️
                </button>
              </div>

              {/* Basic Info */}
              <div className="info-section">
                <h3 className="sub-title">📋 나의 기재사항</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">연락처</span>
                    <span className="info-value">{selectedStudent.info.contact}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">이메일 주소</span>
                    <span className="info-value">{selectedStudent.info.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">생년월일</span>
                    <span className="info-value">{selectedStudent.info.birthDate}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">알게 된 경로</span>
                    <span className="info-value">{selectedStudent.info.visitRoute}</span>
                  </div>
                  <div className="info-item full-width" style={{ gridColumn: 'span 2' }}>
                    <span className="info-label">주소</span>
                    <span className="info-value">{selectedStudent.info.address}</span>
                  </div>
                </div>
              </div>

              {/* Score breakdown bar */}
              <div className="info-section">
                <h3 className="sub-title">📊 나의 스피치 역량 분포</h3>
                <div className="score-details-row">
                  <div className="score-detail-card">
                    <div className="score-detail-meta">
                      <span>내용 구성</span>
                      <strong>{selectedStudent.scores?.contentAbility ?? 0} / 5점</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill content-fill"
                        style={{ width: `${(selectedStudent.scores?.contentAbility ?? 0 / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="score-detail-card">
                    <div className="score-detail-meta">
                      <span>표현 전달</span>
                      <strong>{selectedStudent.scores?.deliveryAbility ?? 0} / 10점</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill delivery-fill"
                        style={{ width: `${(selectedStudent.scores?.deliveryAbility ?? 0 / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="score-detail-card">
                    <div className="score-detail-meta">
                      <span>청중 상호작용</span>
                      <strong>{selectedStudent.scores?.interactionAbility ?? 0} / 5점</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill interaction-fill"
                        style={{ width: `${(selectedStudent.scores?.interactionAbility ?? 0 / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="score-totals-card">
                  <span>종합 스피치 실력 점수:</span>
                  <strong className="text-indigo">
                    {(selectedStudent.scores?.contentAbility ?? 0) + (selectedStudent.scores?.deliveryAbility ?? 0) + (selectedStudent.scores?.interactionAbility ?? 0)}
                  </strong>
                  <span>/ 20점</span>
                </div>
              </div>

              {/* Symptoms Checklist */}
              <div className="info-section">
                <h3 className="sub-title">⚠️ 자가진단 스피치 증상 ({selectedStudent.symptoms.length}개 선택)</h3>
                <div className="symptoms-display-grid">
                  <div className="symptom-display-category">
                    <h4>1. 내용구성</h4>
                    <ul>
                      {SYMPTOM_CATEGORIES.content.map(s => {
                        const checked = selectedStudent.symptoms.includes(s);
                        return (
                          <li key={s} className={checked ? 'checked-item' : 'unchecked-item'}>
                            <span>{checked ? '🔴' : '⚪'}</span> {s}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="symptom-display-category">
                    <h4>2. 표현 및 전달</h4>
                    <ul>
                      {SYMPTOM_CATEGORIES.delivery.map(s => {
                        const checked = selectedStudent.symptoms.includes(s);
                        return (
                          <li key={s} className={checked ? 'checked-item' : 'unchecked-item'}>
                            <span>{checked ? '🔴' : '⚪'}</span> {s}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="symptom-display-category">
                    <h4>3. 청중과 상호작용</h4>
                    <ul>
                      {SYMPTOM_CATEGORIES.interaction.map(s => {
                        const checked = selectedStudent.symptoms.includes(s);
                        return (
                          <li key={s} className={checked ? 'checked-item' : 'unchecked-item'}>
                            <span>{checked ? '🔴' : '⚪'}</span> {s}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Consultation Memo JPG display */}
              <div className="info-section">
                <h3 className="sub-title">🖼️ 나의 스피치 상담 기록 보고서 (저장 완료)</h3>
                <div className="memo-document-wrapper">
                  <div className="doc-image-container">
                    <img
                      src={selectedStudent.memoImageUrl}
                      alt="상담 메모 보고서 JPG"
                      className="dashboard-memo-img"
                    />
                  </div>
                  <a
                    href={selectedStudent.memoImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-medium"
                    style={{ width: '100%' }}
                  >
                    💾 원본 고화질 이미지 새 창에서 열기
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-details card text-center">
              <div className="empty-icon">📂</div>
              <h3>저장된 진단 결과가 아직 없어요</h3>
              <p>상단의 "진단 작성하기" 탭에서 스피치 자가 점검을 완료해 보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
