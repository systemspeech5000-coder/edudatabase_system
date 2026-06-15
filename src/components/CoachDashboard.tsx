import React, { useEffect, useMemo, useState } from 'react';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { type StudentRecord, SYMPTOM_CATEGORIES } from '../types';

const SPEECH_TYPES = ['주도형', '사교형', '안정형', '신중형'];

const SYMPTOM_SECTION_LABELS = {
  content: '내용구성 능력',
  delivery: '표현 및 전달 능력',
  interaction: '청중과 상호작용 능력',
};

const SYMPTOM_SECTION_EMOJIS: Record<string, string> = {
  '내용구성 능력': '📝',
  '표현 및 전달 능력': '🎤',
  '청중과 상호작용 능력': '👥',
};

const getDateObject = (value: any) => {
  if (!value) return null;

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateInputValue = (value: any) => {
  const date = getDateObject(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getKoreanDate = (value: any) => {
  const date = getDateObject(value);
  if (!date) return '-';

  return date.toLocaleDateString('ko-KR');
};

const truncateText = (text: string, maxLength = 7) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
};

export const CoachDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<{
    title: string;
    count: number;
    category?: string;
    source: 'top5' | 'distribution';
  } | null>(null);

  const [galleryNameInput, setGalleryNameInput] = useState('');
  const [galleryStartInput, setGalleryStartInput] = useState('');
  const [galleryEndInput, setGalleryEndInput] = useState('');

  const [appliedGalleryName, setAppliedGalleryName] = useState('');
  const [appliedGalleryStartDate, setAppliedGalleryStartDate] = useState('');
  const [appliedGalleryEndDate, setAppliedGalleryEndDate] = useState('');

  const openCuteDetail = (
    event: React.MouseEvent,
    title: string,
    count: number,
    category: string | undefined,
    source: 'top5' | 'distribution'
  ) => {
    event.stopPropagation();

    setSelectedDetail({
      title,
      count,
      category,
      source,
    });
  };

  const loadRecords = async () => {
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
      } else {
        const localData = localStorage.getItem('voxmonitor_students');

        if (localData) {
          const records: StudentRecord[] = JSON.parse(localData);
          records.sort((a, b) => {
            const dateA = getDateObject(a.createdAt)?.getTime() ?? 0;
            const dateB = getDateObject(b.createdAt)?.getTime() ?? 0;
            return dateB - dateA;
          });
          setStudents(records);
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
    loadRecords();
  }, []);

  const galleryFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const studentName = student.name?.toLowerCase() ?? '';
      const matchesName = studentName.includes(appliedGalleryName.trim().toLowerCase());

      const studentDate = getDateInputValue(student.createdAt);

      const matchesStartDate = !appliedGalleryStartDate || studentDate >= appliedGalleryStartDate;
      const matchesEndDate = !appliedGalleryEndDate || studentDate <= appliedGalleryEndDate;

      return matchesName && matchesStartDate && matchesEndDate;
    });
  }, [students, appliedGalleryName, appliedGalleryStartDate, appliedGalleryEndDate]);

  const handleGallerySearch = () => {
    setAppliedGalleryName(galleryNameInput);
    setAppliedGalleryStartDate(galleryStartInput);
    setAppliedGalleryEndDate(galleryEndInput);
  };

  const clearGallerySearch = () => {
    setGalleryNameInput('');
    setGalleryStartInput('');
    setGalleryEndInput('');
    setAppliedGalleryName('');
    setAppliedGalleryStartDate('');
    setAppliedGalleryEndDate('');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 님의 상담일지를 삭제할까요?`)) {
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
          const filtered = records.filter((r) => r.id !== id);
          localStorage.setItem('voxmonitor_students', JSON.stringify(filtered));
        }
      }

      setStudents((prev) => prev.filter((r) => r.id !== id));
      alert('상담일지가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete student:', error);
      alert('삭제 도중 문제가 생겼어요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = useMemo(() => {
    const totalCount = students.length;

    const typeCounts = SPEECH_TYPES.map((type) => {
      const count = students.filter((s) => s.speechType === type).length;
      const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;

      return {
        label: type,
        count,
        percent,
      };
    });

    const averageContent =
      totalCount > 0
        ? students.reduce((sum, s) => sum + (s.scores?.contentAbility ?? 0), 0) / totalCount
        : 0;

    const averageDelivery =
      totalCount > 0
        ? students.reduce((sum, s) => sum + (s.scores?.deliveryAbility ?? 0), 0) / totalCount
        : 0;

    const averageInteraction =
      totalCount > 0
        ? students.reduce((sum, s) => sum + (s.scores?.interactionAbility ?? 0), 0) / totalCount
        : 0;

    const symptomDistribution = Object.entries(SYMPTOM_CATEGORIES).flatMap(([categoryKey, symptoms]) =>
      symptoms.map((symptom) => {
        const count = students.filter((student) => student.symptoms?.includes(symptom)).length;

        return {
          category: SYMPTOM_SECTION_LABELS[categoryKey as keyof typeof SYMPTOM_SECTION_LABELS],
          symptom,
          count,
        };
      })
    );

    const groupedSymptomDistribution = Object.entries(SYMPTOM_CATEGORIES).map(([categoryKey, symptoms]) => {
      const categoryLabel = SYMPTOM_SECTION_LABELS[categoryKey as keyof typeof SYMPTOM_SECTION_LABELS];

      const items = symptoms
        .map((symptom) => {
          const count = students.filter((student) => student.symptoms?.includes(symptom)).length;

          return {
            category: categoryLabel,
            symptom,
            count,
          };
        })
        .sort((a, b) => b.count - a.count);

      const totalChecked = items.reduce((sum, item) => sum + item.count, 0);

      return {
        category: categoryLabel,
        totalChecked,
        items,
      };
    });


    const topFiveSymptoms = [...symptomDistribution]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const abilityRates = [
      {
        label: '내용 구성',
        score: averageContent,
        max: 5,
        rate: 5 > 0 ? averageContent / 5 : 0,
      },
      {
        label: '표현 전달',
        score: averageDelivery,
        max: 10,
        rate: 10 > 0 ? averageDelivery / 10 : 0,
      },
      {
        label: '청중 상호작용',
        score: averageInteraction,
        max: 5,
        rate: 5 > 0 ? averageInteraction / 5 : 0,
      },
    ];

    const lowestAbility = [...abilityRates].sort((a, b) => a.rate - b.rate)[0];

    return {
      totalCount,
      typeCounts,
      averageContent,
      averageDelivery,
      averageInteraction,
      groupedSymptomDistribution,
      topFiveSymptoms,
      lowestAbility,
    };
  }, [students]);

  const renderSmallSpeechTypeRow = () => {
    const typeMeta: Record<
      string,
      {
        emoji: string;
        animal: string;
        bg: string;
        border: string;
        color: string;
      }
    > = {
      주도형: {
        emoji: '🦁',
        animal: '사자형',
        bg: '#fff7ed',
        border: '#fed7aa',
        color: '#9a3412',
      },
      사교형: {
        emoji: '🐬',
        animal: '돌고래형',
        bg: '#eff6ff',
        border: '#bfdbfe',
        color: '#1d4ed8',
      },
      안정형: {
        emoji: '🕊️',
        animal: '비둘기형',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        color: '#166534',
      },
      신중형: {
        emoji: '🦉',
        animal: '부엉이형',
        bg: '#faf5ff',
        border: '#ddd6fe',
        color: '#6d28d9',
      },
    };

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
          gap: '0.7rem',
          margin: '0.9rem 0 1.4rem 0',
        }}
      >
        {stats.typeCounts.map((item) => {
          const meta = typeMeta[item.label];

          return (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                background: meta.bg,
                border: `1px solid ${meta.border}`,
                borderRadius: '16px',
                padding: '0.65rem 0.75rem',
                opacity: 0.82,
              }}
            >
              <span
                style={{
                  fontSize: '1.45rem',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {meta.emoji}
              </span>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: meta.color,
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    lineHeight: 1.2,
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    color: '#64748b',
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    marginTop: '0.12rem',
                  }}
                >
                  {item.count}명
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCardShell = (
    title: string,
    desc: string,
    content: React.ReactNode,
    extraStyle: React.CSSProperties = {}
  ) => {
    return (
      <div
        className="info-section"
        style={{
          border: '1px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '26px',
          padding: '1.35rem',
          background: '#ffffff',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
          minWidth: 0,
          ...extraStyle,
        }}
      >
        <h3 className="sub-title" style={{ marginBottom: '0.45rem' }}>
          {title}
        </h3>

        <p
          style={{
            fontSize: '0.78rem',
            color: '#64748b',
            margin: '0 0 1rem 0',
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {desc}
        </p>

        {content}
      </div>
    );
  };

  const renderAbilityAverageTriangle = () => {
    const items = [
      {
        label: '내용 구성',
        score: stats.averageContent,
        max: 5,
        color: '#4338ca',
      },
      {
        label: '표현 전달',
        score: stats.averageDelivery,
        max: 10,
        color: '#7e22ce',
      },
      {
        label: '청중 상호작용',
        score: stats.averageInteraction,
        max: 5,
        color: '#be185d',
      },
    ];

    const centerX = 240;
    const centerY = 200;
    const radius = 138;
    const labelRadius = 182;
    const total = 3;

    const getPoint = (index: number, ratio: number, r = radius) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / total;

      return {
        x: centerX + r * ratio * Math.cos(angle),
        y: centerY + r * ratio * Math.sin(angle),
      };
    };

    const outerPoints = items
      .map((_, index) => {
        const point = getPoint(index, 1);
        return `${point.x},${point.y}`;
      })
      .join(' ');

    const valuePoints = items
      .map((item, index) => {
        const ratio = item.max > 0 ? item.score / item.max : 0;
        const point = getPoint(index, ratio);
        return `${point.x},${point.y}`;
      })
      .join(' ');

    return (
      <div
        style={{
          border: '1px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '20px',
          padding: '1rem',
          background: 'rgba(248, 250, 252, 0.8)',
          minHeight: '430px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 480 430" width="100%" height="390" style={{ display: 'block' }}>
          <polygon points={outerPoints} fill="none" stroke="#e9d5ff" strokeWidth="2.2" />

          {items.map((_, index) => {
            const point = getPoint(index, 1);

            return (
              <line
                key={`ability-axis-${index}`}
                x1={centerX}
                y1={centerY}
                x2={point.x}
                y2={point.y}
                stroke="#e2e8f0"
                strokeWidth="1.5"
              />
            );
          })}

          <polygon
            points={valuePoints}
            fill="#8b5cf6"
            fillOpacity="0.3"
            stroke="#8b5cf6"
            strokeWidth="4"
          />

          {items.map((item, index) => {
            const ratio = item.max > 0 ? item.score / item.max : 0;
            const point = getPoint(index, ratio);
            const labelPoint = getPoint(index, 1, labelRadius);

            return (
              <g key={`ability-label-${item.label}`}>
                <circle cx={point.x} cy={point.y} r="6.5" fill={item.color} />

                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="17"
                  fontWeight="950"
                  fill="#334155"
                >
                  {item.label}
                </text>

                <text
                  x={labelPoint.x}
                  y={labelPoint.y + 27}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="17"
                  fontWeight="950"
                  fill={item.color}
                >
                  {item.score.toFixed(1)} / {item.max}점
                </text>
              </g>
            );
          })}
        </svg>


      </div>
    );
  };

  const renderTopFiveInsight = () => {
    const first = stats.topFiveSymptoms[0];
    const second = stats.topFiveSymptoms[1];

    if (!first && !second) {
      return null;
    }

    const boxStyle: React.CSSProperties = {
      marginBottom: '0.85rem',
      padding: '0.8rem 1rem',
      borderRadius: '16px',
      background: '#fff7ed',
      border: '1px solid #fed7aa',
      color: '#9a3412',
      fontSize: '0.95rem',
      fontWeight: 900,
      textAlign: 'left',
      lineHeight: 1.55,
      wordBreak: 'keep-all',
      overflowWrap: 'break-word',
    };

    if (first && !second) {
      return (
        <div style={boxStyle}>
          <span>학생들은 평균적으로 </span>
          <strong style={{ color: '#ea580c', fontWeight: 950 }}>
            {first.symptom}
          </strong>
          <span>고 응답했습니다.</span>
        </div>
      );
    }

    return (
      <div style={boxStyle}>
        <span>학생들은 평균적으로 </span>
        <strong style={{ color: '#ea580c', fontWeight: 950 }}>
          {first.symptom}
        </strong>
        <span>와 </span>
        <strong style={{ color: '#ea580c', fontWeight: 950 }}>
          {second?.symptom}
        </strong>
        <span>고 응답했습니다.</span>
      </div>
    );
  };

  const renderTopFiveBarChart = () => {
    const items =
      stats.topFiveSymptoms.length > 0
        ? stats.topFiveSymptoms
        : [{ symptom: '데이터 없음', category: '', count: 0 }];

    const maxCount = Math.max(...items.map((item) => item.count), 1);
    const chartWidth = 480;
    const chartHeight = 430;
    const leftPadding = 54;
    const rightPadding = 24;
    const topPadding = 50;
    const bottomPadding = 96;
    const availableWidth = chartWidth - leftPadding - rightPadding;
    const availableHeight = chartHeight - topPadding - bottomPadding;
    const barGap = 18;
    const barWidth = Math.max(32, (availableWidth - barGap * (items.length - 1)) / items.length);

    return (
      <div
        style={{
          border: '1px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '20px',
          padding: '1rem',
          background: 'rgba(248, 250, 252, 0.8)',
          minHeight: '500px',
        }}
      >
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="390" style={{ display: 'block' }}>
          <line
            x1={leftPadding}
            y1={topPadding}
            x2={leftPadding}
            y2={chartHeight - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          <line
            x1={leftPadding}
            y1={chartHeight - bottomPadding}
            x2={chartWidth - rightPadding}
            y2={chartHeight - bottomPadding}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {[0, 0.5, 1].map((ratio) => {
            const y = topPadding + availableHeight * (1 - ratio);
            const label = Math.round(maxCount * ratio);

            return (
              <g key={`top5-y-${ratio}`}>
                <line
                  x1={leftPadding}
                  y1={y}
                  x2={chartWidth - rightPadding}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                <text
                  x={leftPadding - 9}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  fontWeight="800"
                >
                  {label}
                </text>
              </g>
            );
          })}

          <text
            x={leftPadding - 33}
            y={topPadding + 4}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
            fontWeight="900"
          >
            명
          </text>

          {items.map((item, index) => {
            const barHeight = maxCount > 0 ? (item.count / maxCount) * availableHeight : 0;
            const x = leftPadding + 12 + index * (barWidth + barGap);
            const y = chartHeight - bottomPadding - barHeight;

            return (
              <g
                key={`top5-bar-${item.symptom}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => openCuteDetail(e, item.symptom, item.count, item.category, 'top5')}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="10"
                  fill="#8b5cf6"
                  opacity={item.count === maxCount && item.count > 0 ? 1 : 0.72}
                />

                <text
                  x={x + barWidth / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="950"
                  fill="#4c1d95"
                >
                  {item.count}명
                </text>

                <text
                  x={x + barWidth / 2}
                  y={chartHeight - bottomPadding + 21}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="850"
                  fill="#334155"
                >
                  {truncateText(item.symptom, 5)}
                </text>

                <text
                  x={x + barWidth / 2}
                  y={chartHeight - bottomPadding + 39}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="850"
                  fill="#7c3aed"
                >
                  {index + 1}순위
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderEmotionDistributionInsight = () => {
    const contentTop = stats.groupedSymptomDistribution.find(
      (group) => group.category === '내용구성 능력'
    )?.items[0];

    const deliveryTop = stats.groupedSymptomDistribution.find(
      (group) => group.category === '표현 및 전달 능력'
    )?.items[0];

    const interactionTop = stats.groupedSymptomDistribution.find(
      (group) => group.category === '청중과 상호작용 능력'
    )?.items[0];

    if (!contentTop && !deliveryTop && !interactionTop) {
      return null;
    }

    return (
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '16px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#9a3412',
          fontSize: '0.95rem',
          fontWeight: 900,
          textAlign: 'left',
          lineHeight: 1.65,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
        }}
      >
        <div style={{ marginBottom: '0.35rem' }}>
          학생들은 평균적으로
        </div>

        <div>
          내용 구성능력에서는{' '}
          <strong style={{ color: '#ea580c', fontWeight: 950 }}>
            {contentTop?.symptom ?? '-'}
          </strong>
          ,
        </div>

        <div>
          표현 및 전달능력에서는{' '}
          <strong style={{ color: '#ea580c', fontWeight: 950 }}>
            {deliveryTop?.symptom ?? '-'}
          </strong>
          ,
        </div>

        <div>
          청중과 상호작용 능력에서는{' '}
          <strong style={{ color: '#ea580c', fontWeight: 950 }}>
            {interactionTop?.symptom ?? '-'}
          </strong>
          고 응답했습니다.
        </div>
      </div>
    );
  };

  const renderEmotionRankingCard = (
    group: {
      category: string;
      totalChecked: number;
      items: { symptom: string; category: string; count: number }[];
    }
  ) => {
    const emoji = SYMPTOM_SECTION_EMOJIS[group.category] ?? '💬';

    return (
      <div
        key={group.category}
        style={{
          border: '1px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '22px',
          padding: '1rem',
          background: 'rgba(248, 250, 252, 0.78)',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
            alignItems: 'center',
            marginBottom: '0.8rem',
          }}
        >
          <h4
            style={{
              margin: 0,
              color: '#4c1d95',
              fontSize: '1.05rem',
              fontWeight: 950,
            }}
          >
            {emoji} {group.category}
          </h4>

          <span
            style={{
              fontSize: '0.76rem',
              fontWeight: 900,
              color: '#7c3aed',
              background: '#ede9fe',
              padding: '0.22rem 0.5rem',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
            }}
          >
            총 {group.totalChecked}개
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          {group.items.map((item, index) => {
            const isTopThree = index < 1;

            return (
              <button
                key={`${group.category}-${item.symptom}`}
                type="button"
                onClick={(e) => openCuteDetail(e, item.symptom, item.count, item.category, 'distribution')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px minmax(0, 1fr) 58px',
                  gap: '0.55rem',
                  alignItems: 'center',
                  width: '100%',
                  border: isTopThree ? '1.5px solid #c4b5fd' : '1px solid rgba(226, 232, 240, 0.9)',
                  background: isTopThree ? '#faf5ff' : '#ffffff',
                  borderRadius: '14px',
                  padding: '0.58rem 0.7rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isTopThree ? '0 10px 18px rgba(124, 58, 237, 0.12)' : 'none',
                }}
              >
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '11px',
                    background: isTopThree ? '#7c3aed' : '#f8fafc',
                    color: isTopThree ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isTopThree ? '0.86rem' : '0.78rem',
                    fontWeight: 950,
                  }}
                >
                  {index + 1}
                </span>

                <span
                  style={{
                    color: isTopThree ? '#4c1d95' : '#334155',
                    fontSize: isTopThree ? '0.88rem' : '0.82rem',
                    fontWeight: isTopThree ? 950 : 800,
                    lineHeight: 1.35,
                    wordBreak: 'keep-all',
                    overflowWrap: 'break-word',
                  }}
                >
                  {item.symptom}
                </span>

                <strong
                  style={{
                    color: isTopThree ? '#7c3aed' : '#64748b',
                    fontSize: isTopThree ? '0.86rem' : '0.8rem',
                    fontWeight: 950,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.count}명
                </strong>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="coach-dashboard-wrapper animate-fade-in">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          기록 불러오는 중... 🕊️
        </div>
      </div>
    );
  }

  return (
    <div
      className="coach-dashboard-wrapper animate-fade-in"
      style={{
        width: '100%',
        maxWidth: '1500px',
        margin: '0 auto',
      }}
    >
      {selectedDetail && (
        <div
          onClick={() => setSelectedDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'transparent',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: selectedDetail.source === 'top5' ? '3.5rem' : '2.5rem',
              top: selectedDetail.source === 'top5' ? '170px' : '470px',
              transform: selectedDetail.source === 'top5' ? 'translateY(120px)' : 'none',
              width: '300px',
              background: '#ffffff',
              borderRadius: '22px',
              padding: '1rem 1.1rem',
              boxShadow: '0 16px 38px rgba(88, 28, 135, 0.18)',
              border: '1.5px solid #ddd6fe',
              zIndex: 10000,
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: '-8px',
                left: '24px',
                width: '16px',
                height: '16px',
                background: '#ffffff',
                borderRight: '1.5px solid #ddd6fe',
                borderBottom: '1.5px solid #ddd6fe',
                transform: 'rotate(45deg)',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '13px',
                  background: 'linear-gradient(135deg, #a78bfa, #f0abfc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                }}
              >
                💬
              </div>

              <div style={{ minWidth: 0 }}>
                {selectedDetail.category && (
                  <div
                    style={{
                      display: 'inline-block',
                      marginBottom: '0.35rem',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: '#7c3aed',
                      background: '#ede9fe',
                      padding: '0.18rem 0.5rem',
                      borderRadius: '999px',
                    }}
                  >
                    {selectedDetail.category}
                  </div>
                )}

                <div
                  style={{
                    color: '#334155',
                    fontSize: '0.9rem',
                    fontWeight: 850,
                    lineHeight: 1.45,
                    wordBreak: 'keep-all',
                    overflowWrap: 'break-word',
                  }}
                >
                  {selectedDetail.title}
                </div>

                <div
                  style={{
                    marginTop: '0.45rem',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 750,
                  }}
                >
                  총 <strong style={{ color: '#c026d3' }}>{selectedDetail.count}명</strong>이 체크했어요.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          height: 'auto',
          maxHeight: 'none',
          overflow: 'visible',
          width: '100%',
        }}
      >
        <div className="details-header" style={{ marginBottom: '0.8rem' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem' }}>📊 학생 진단 결과 요약</h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.35rem' }}>
              총 {stats.totalCount}명의 제출 결과를 기준으로 계산했습니다.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={loadRecords}
          >
            새로고침
          </button>
        </div>

        {stats.totalCount === 0 ? (
          <div className="empty-list-state">
            아직 제출된 진단 기록이 없습니다.
          </div>
        ) : (
          <>
            {renderSmallSpeechTypeRow()}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '1.5rem',
                alignItems: 'start',
              }}
            >
              <div
                className="info-section"
                style={{
                  border: '1px solid rgba(226, 232, 240, 0.95)',
                  borderRadius: '26px',
                  padding: '1.35rem',
                  background: '#ffffff',
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(420px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'stretch',
                  }}
                >
                  <div>
                    <h3
                      className="sub-title"
                      style={{
                        marginBottom: '0.45rem',
                        color: '#4c1d95',
                        fontSize: '1.08rem',
                        fontWeight: 950,
                      }}
                    >
                      🎤 스피치 능력 평균
                    </h3>

                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: '#64748b',
                        margin: '0 0 0.75rem 0',
                        fontWeight: 700,
                        lineHeight: 1.45,
                      }}
                    >
                      내용 구성, 표현 전달, 청중 상호작용의 평균 점수를 확인할 수 있습니다.
                    </p>

                    <div
                      style={{
                        marginBottom: '0.85rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '16px',
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        color: '#4c1d95',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        textAlign: 'center',
                        lineHeight: 1.45,
                      }}
                    >
                      학생들은 평균적으로{' '}
                      <strong style={{ color: '#7c3aed', fontWeight: 950 }}>
                        {stats.lowestAbility?.label}
                      </strong>{' '}
                      능력이 가장 낮습니다.
                    </div>

                    {renderAbilityAverageTriangle()}
                  </div>

                  <div>
                    <h3
                      className="sub-title"
                      style={{
                        marginBottom: '0.45rem',
                        color: '#4c1d95',
                        fontSize: '1.08rem',
                        fontWeight: 950,
                      }}
                    >
                      🔥 많이 나타난 정서 TOP 5
                    </h3>

                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: '#64748b',
                        margin: '0 0 0.75rem 0',
                        fontWeight: 700,
                        lineHeight: 1.45,
                      }}
                    >
                      가장 많이 체크된 정서를 X축과 Y축 그래프로 확인할 수 있습니다.
                    </p>

                    {renderTopFiveInsight()}


                    {renderTopFiveBarChart()}
                  </div>
                </div>
              </div>



              {renderCardShell(
                '💬 스피치 정서 분포',
                '가장 많이 나타난 정서를 순위로 확인할 수 있습니다.',
                <>
                  {renderEmotionDistributionInsight()}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
                      gap: '1rem',
                      alignItems: 'start',
                    }}
                  >
                    {stats.groupedSymptomDistribution.map((group) => renderEmotionRankingCard(group))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="details-panel">
        <div className="details-card card animate-fade-in">
          <div className="details-header">
            <div>
              <h2 style={{ fontSize: '1.45rem' }}>🖼️ 상담일지 보기</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.35rem' }}>
                학생 이름과 작성 기간으로 상담 기록 보고서를 검색할 수 있습니다.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 1.3fr) minmax(190px, 1fr) minmax(190px, 1fr) auto auto',
              gap: '1rem',
              alignItems: 'end',
              marginBottom: '1.5rem',
              padding: '1.25rem',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(243, 232, 255, 0.65))',
              border: '1px solid rgba(196, 181, 253, 0.55)',
              boxShadow: '0 14px 32px rgba(88, 28, 135, 0.08)',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: '#4c1d95',
                  marginBottom: '0.45rem',
                  display: 'block',
                }}
              >
                학생 이름
              </label>

              <input
                type="text"
                value={galleryNameInput}
                onChange={(e) => setGalleryNameInput(e.target.value)}
                placeholder="학생 이름을 입력하세요"
                style={{
                  height: '48px',
                  borderRadius: '16px',
                  border: '1.5px solid #ddd6fe',
                  background: '#ffffff',
                  padding: '0 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  boxShadow: '0 6px 14px rgba(88, 28, 135, 0.06)',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: '#4c1d95',
                  marginBottom: '0.45rem',
                  display: 'block',
                }}
              >
                시작 날짜
              </label>

              <input
                type="date"
                value={galleryStartInput}
                onChange={(e) => setGalleryStartInput(e.target.value)}
                style={{
                  height: '48px',
                  borderRadius: '16px',
                  border: '1.5px solid #ddd6fe',
                  background: '#ffffff',
                  padding: '0 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  boxShadow: '0 6px 14px rgba(88, 28, 135, 0.06)',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: '#4c1d95',
                  marginBottom: '0.45rem',
                  display: 'block',
                }}
              >
                종료 날짜
              </label>

              <input
                type="date"
                value={galleryEndInput}
                onChange={(e) => setGalleryEndInput(e.target.value)}
                style={{
                  height: '48px',
                  borderRadius: '16px',
                  border: '1.5px solid #ddd6fe',
                  background: '#ffffff',
                  padding: '0 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  boxShadow: '0 6px 14px rgba(88, 28, 135, 0.06)',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGallerySearch}
              style={{
                height: '48px',
                borderRadius: '16px',
                padding: '0 1.25rem',
                fontWeight: 900,
                boxShadow: '0 10px 20px rgba(124, 58, 237, 0.22)',
                whiteSpace: 'nowrap',
              }}
            >
              검색
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearGallerySearch}
              style={{
                height: '48px',
                borderRadius: '16px',
                padding: '0 1.1rem',
                fontWeight: 850,
                whiteSpace: 'nowrap',
              }}
            >
              초기화
            </button>
          </div>

          {galleryFilteredStudents.length === 0 ? (
            <div className="empty-details text-center">
              <div className="empty-icon">📂</div>
              <h3>조건에 맞는 상담일지가 없어요</h3>
              <p>학생 이름 또는 날짜 검색 조건을 다시 확인해주세요.</p>
            </div>
          ) : (
            <div
              className="memo-gallery-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {galleryFilteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="memo-gallery-card"
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: '16px',
                    padding: '0.7rem',
                    background: '#fff',
                    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <div style={{ marginBottom: '0.55rem' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{student.name}</strong>

                    <div
                      style={{
                        marginTop: '0.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.7rem',
                        color: '#64748b',
                      }}
                    >
                      <span>{getKoreanDate(student.createdAt)}</span>

                      <span
                        className={`tag type-tag ${student.speechType}`}
                        style={{ fontSize: '0.6rem', padding: '0.1rem 0.32rem' }}
                      >
                        {student.speechType}
                      </span>
                    </div>
                  </div>

                  {student.memoImageUrl ? (
                    <>
                      <a
                        href={student.memoImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'block' }}
                      >
                        <img
                          src={student.memoImageUrl}
                          alt={`${student.name} 상담일지 JPG`}
                          className="dashboard-memo-img"
                          style={{
                            width: '100%',
                            height: '140px',
                            objectFit: 'cover',
                            objectPosition: 'top',
                            borderRadius: '12px',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            background: '#f8fafc',
                          }}
                        />
                      </a>

                      <div
                        style={{
                          display: 'flex',
                          gap: '0.35rem',
                          marginTop: '0.55rem',
                        }}
                      >
                        <a
                          href={student.memoImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-small"
                          style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem' }}
                        >
                          크게 보기
                        </a>

                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          disabled={isDeleting}
                          onClick={() => student.id && handleDelete(student.id, student.name)}
                          style={{ fontSize: '0.72rem' }}
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        height: '140px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px dashed rgba(148, 163, 184, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: '#64748b',
                        padding: '0.75rem',
                        fontSize: '0.78rem',
                      }}
                    >
                      상담일지 이미지가 없습니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};