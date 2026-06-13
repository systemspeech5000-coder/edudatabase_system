export interface StudentInfo {
  address: string;
  birthDate: string;
  visitRoute: string;
  contact: string;
  email: string;
}

export interface SpeechScores {
  contentAbility: number; // 0 ~ 5
  deliveryAbility: number; // 0 ~ 10
  interactionAbility: number; // 0 ~ 5
}

export interface ConsultationMemo {
  pastDifficulty: string;
  futureWorry: string;
  desiredState: string;
}

export type SpeechType = '주도형' | '사교형' | '안정형' | '신중형';

export interface StudentRecord {
  id?: string;
  name: string;
  info: StudentInfo;
  symptoms: string[]; // List of all checked symptoms
  speechType: SpeechType;
  scores: SpeechScores;
  memo: ConsultationMemo;
  memoImageUrl: string; // Firebase Storage URL
  createdAt: string; // ISO date string or timestamp
}

export const SYMPTOM_CATEGORIES = {
  content: [
    '주제와 맞지 않는 내용을 말함',
    '말의 순서가 자연스럽지 않음',
    '핵심 메시지가 분명하지 않음',
    '발표 내용이 일관되지 않고 산으로 감'
  ],
  delivery: [
    '목소리가 떨림',
    '목소리가 작음',
    '발음이 부정확함',
    '표정과 자세가 지나치게 경직됨',
    '말이 너무 빠르거나 느림',
    '목소리가 일자톤임'
  ],
  interaction: [
    '청중이 말에 집중하도록 이끌지 않고 바로 시작함',
    '청중의 표정과 반응, 분위기를 잘 살피지 못함',
    '일방적으로 말하게 됨'
  ]
};
