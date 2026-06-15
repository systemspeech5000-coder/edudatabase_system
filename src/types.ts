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
    '주제에 맞는 내용을 고르기 어렵다',
    '말의 순서를 어떻게 배치할지 모르겠다',
    '핵심이 잘 전달되지 않는다',
    '말하다 내용이 산으로 간다',
  ],
  delivery: [
    '발음이 부정확해 알아듣기 어렵다',
    '문장이 안끊어지고 계속 한문장으로 말한다',
    '목소리가 너무 작다',
    '목소리가 일자톤이다',
    '표정, 시선, 자세 처리가 어렵다',
    '말이 점점 빨라진다',
    '자신감이 없고 불안정하다',
  ],
  interaction: [
    '청중이 집중하도록 이끌지 못한다',
    '청중의 표정, 반응, 분위기를 살피지 못한다',
    '청중과 연결되는 느낌이 아니라 일방적으로 말한다',
    '청중의 반응에 따라 발표방식이나 태도를 조절하지 못한다',
  ]
};
