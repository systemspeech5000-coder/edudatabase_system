import type { ConsultationMemo, SpeechScores, SpeechType } from '../types';

export function generateConsultationMemoJpg(
  studentName: string,
  speechType: SpeechType,
  symptoms: string[],
  scores: SpeechScores,
  memo: ConsultationMemo,
  dateString: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context is not available'));
      return;
    }

    // Set high-resolution dimensions for multi-section report sheet
    canvas.width = 800;
    canvas.height = 1150;

    // 1. Draw Background
    ctx.fillStyle = '#f8fafc'; // slate 50
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw deep slate outer border
    ctx.strokeStyle = '#e2e8f0'; // slate 200
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

    // Draw inner accent line
    ctx.strokeStyle = '#8b5cf6'; // violet 500
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

    // 2. Header Box
    ctx.fillStyle = '#8b5cf6'; // Violet primary
    ctx.fillRect(23, 23, canvas.width - 46, 110);

    // Header Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('스피치 상담 종합 기록부', canvas.width / 2, 75);

    ctx.font = '500 14px sans-serif';
    ctx.fillStyle = '#ddd6fe'; // violet 200
    ctx.fillText('VoxMonitor Speech & Emotional Analysis Report', canvas.width / 2, 105);

    // 3. Student Metadata Area
    ctx.fillStyle = '#1e293b'; // slate 800
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`수강생 성명: ${studentName}`, 50, 175);

    ctx.textAlign = 'right';
    ctx.font = '500 14px sans-serif';
    ctx.fillStyle = '#64748b'; // slate 500
    ctx.fillText(`작성일자: ${dateString}`, canvas.width - 50, 175);

    // Divider Line
    ctx.strokeStyle = '#cbd5e1'; // slate 300
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 195);
    ctx.lineTo(canvas.width - 50, 195);
    ctx.stroke();

    let currentY = 230;

    // SECTION 1: 기본 진단 요약 (스피치 유형 및 삼각형 역량 분포)
    drawSectionHeader(ctx, '01', '스피치 기초 분석 요약', currentY);
    currentY += 40;

    // A. Left Card: Speech Type Card
    ctx.fillStyle = '#f1f5f9'; // slate 100
    ctx.fillRect(50, currentY, 330, 150);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, currentY, 330, 150);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`나의 스피치 스타일: ${speechType}`, 70, currentY + 35);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#475569';
    const typeDesc = getSpeechTypeDesc(speechType);
    const typeDescLines = wrapText(ctx, typeDesc, 290);
    typeDescLines.forEach((line, index) => {
      ctx.fillText(line, 70, currentY + 65 + index * 20);
    });

    // B. Right Card: Triangle Radar Chart (삼각형 스피치 역량 분포)
    const rcx = 580;
    const rcy = currentY + 75;
    const maxR = 60;

    // Grid coordinates
    const g1x = rcx;
    const g1y = rcy - maxR;
    const g2x = rcx + maxR * 0.866;
    const g2y = rcy + maxR * 0.5;
    const g3x = rcx - maxR * 0.866;
    const g3y = rcy + maxR * 0.5;

    // Draw background triangle
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(g1x, g1y);
    ctx.lineTo(g2x, g2y);
    ctx.lineTo(g3x, g3y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw grid axes
    ctx.beginPath();
    ctx.moveTo(rcx, rcy); ctx.lineTo(g1x, g1y);
    ctx.moveTo(rcx, rcy); ctx.lineTo(g2x, g2y);
    ctx.moveTo(rcx, rcy); ctx.lineTo(g3x, g3y);
    ctx.stroke();

    // Value scaling factors
    const vc = (scores?.contentAbility ?? 0) / 5;
    const vd = (scores?.deliveryAbility ?? 0) / 10;
    const vi = (scores?.interactionAbility ?? 0) / 5;

    const v1x = rcx;
    const v1y = rcy - maxR * vc;
    const v2x = rcx + maxR * vd * 0.866;
    const v2y = rcy + maxR * vd * 0.5;
    const v3x = rcx - maxR * vi * 0.866;
    const v3y = rcy + maxR * vi * 0.5;

    // Draw student score polygon (translucent violet fill)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(v1x, v1y);
    ctx.lineTo(v2x, v2y);
    ctx.lineTo(v3x, v3y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw dots at polygon vertices
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath(); ctx.arc(v1x, v1y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(v2x, v2y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(v3x, v3y, 4, 0, Math.PI * 2); ctx.fill();

    // Draw radar charts text labels
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`내용구성(${scores?.contentAbility ?? 0}/5)`, rcx, rcy - maxR - 8);
    ctx.textAlign = 'left';
    ctx.fillText(`표현전달(${scores?.deliveryAbility ?? 0}/10)`, g2x + 5, g2y + 5);
    ctx.textAlign = 'right';
    ctx.fillText(`상호작용(${scores?.interactionAbility ?? 0}/5)`, g3x - 5, g3y + 5);

    currentY += 180;

    // SECTION 2: 자가진단 스피치 증상
    drawSectionHeader(ctx, '02', '자가진단 스피치 증상', currentY);
    currentY += 40;

    ctx.fillStyle = '#475569'; // slate 600
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';

    const symptomsText = Array.isArray(symptoms) && symptoms.length > 0 ? symptoms.join(', ') : Object.values(symptoms ?? {}).flat().length > 0 ? Object.values(symptoms ?? {}).flat().join(', ') : '체크된 스피치 증상이 없습니다.';
    const symptomLines = wrapText(ctx, symptomsText, canvas.width - 100);
    symptomLines.forEach((line) => {
      ctx.fillText(line, 50, currentY);
      currentY += 22;
    });

    currentY += 25;

    // SECTION 3: 발표 고민 메모
    drawSectionHeader(ctx, '03', '발표 고민 메모', currentY);
    currentY += 40;

    const memoSections = [
      {
        title: '과거 발표와 관련해 어려움을 느꼈던 경험',
        content: memo?.pastDifficulty || '입력된 상담 내용이 없습니다.'
      },
      {
        title: '앞으로의 발표에서 가장 걱정되는 부분',
        content: memo?.futureWorry || '입력된 상담 내용이 없습니다.'
      },
      {
        title: '발표에서 원하는 이미지나 상태',
        content: memo?.desiredState || '입력된 상담 내용이 없습니다.'
      }
    ];

    memoSections.forEach((section, index) => {
      // Question Title
      ctx.fillStyle = '#0f172a'; // slate 900
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Q${index + 1}. ${section.title}`, 50, currentY);
      currentY += 24;

      // Question Answer
      ctx.fillStyle = '#334155'; // slate 700
      ctx.font = '14px sans-serif';
      const lines = wrapText(ctx, section.content, canvas.width - 100);
      lines.forEach((line) => {
        ctx.fillText(line, 55, currentY);
        currentY += 22;
      });

      currentY += 25;
    });

    // 5. Draw Footer
    ctx.fillStyle = '#94a3b8'; // slate 400
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('본 문서는 스피치 자가 진단 결과에 의거해 생성되었습니다.', canvas.width / 2, canvas.height - 40);

    // Convert the rendering to a JPEG Blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to output canvas contents as JPEG blob.'));
        }
      },
      'image/jpeg',
      0.92
    );
  });
}

function drawSectionHeader(ctx: CanvasRenderingContext2D, num: string, title: string, y: number) {
  // Index Circle
  ctx.fillStyle = '#f5f3ff'; // violet 50
  ctx.beginPath();
  ctx.arc(65, y - 6, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b5cf6'; // violet 500
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(num, 65, y - 1);

  // Section Title Text
  ctx.fillStyle = '#0f172a'; // slate 900
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 95, y);

  // Bottom Divider line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, y + 18);
  ctx.lineTo(800 - 50, y + 18);
  ctx.stroke();
}

function getSpeechTypeDesc(type: SpeechType): string {
  switch (type) {
    case '주도형':
      return '결과를 매우 중요시하며, 단도직입적이고 명확한 메시지를 빠르게 전달하는 Lion형 스타일입니다.';
    case '사교형':
      return '관계 중심의 밝고 유머러스한 스피치를 전개하며, 풍부한 감정이 돋보이는 Dolphin형 스타일입니다.';
    case '안정형':
      return '경청과 배려로 소통하며, 차분하고 일관적인 어조로 편안함을 제공하는 Dove형 스타일입니다.';
    case '신중형':
      return '객관적인 증거와 수치 분석을 기본 논조로 사용하며, 빈틈없는 논리성을 보인 Owl형 스타일입니다.';
    default:
      return '';
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const resultLines: string[] = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.trim() === '') {
      resultLines.push('');
      return;
    }

    let currentLine = '';
    for (let i = 0; i < paragraph.length; i++) {
      const char = paragraph[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        resultLines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  });

  return resultLines;
}
