// BBIP shows every label English-first with the Korean term under it
// (components/bbip/Term.tsx). One vocabulary so the same word reads the
// same everywhere.

export interface BiTerm {
  en: string;
  ko: string;
}

export const T = {
  consult: { en: "Consult", ko: "진료" },
  cases: { en: "Records", ko: "기록" },
  knowledge: { en: "Knowledge", ko: "지식창고" },
  assistant: { en: "Aesthetic GP Assistant", ko: "미용 GP 진료 비서" },

  case: { en: "Case", ko: "케이스" },
  brief: { en: "Key Brief", ko: "핵심" },
  anatomy: { en: "Anatomy Map", ko: "해부 지도" },
  more: { en: "More", ko: "더 보기" },
  care: { en: "Aftercare Orders", ko: "처방·F/U" },
  evidence: { en: "Evidence", ko: "문헌 근거" },
  followupQuestion: { en: "Follow-up", ko: "이어서 묻기" },
  customQuestion: { en: "Your Question", ko: "직접 질문" },

  patient: { en: "Patient", ko: "환자" },
  conditions: { en: "Concerns", ko: "질환·고민" },
  meds: { en: "Medications", ko: "복용약" },
  procedures: { en: "Procedures", ko: "시술" },

  caution: { en: "Caution", ko: "주의" },
  contraindication: { en: "Contraindication", ko: "금기" },
  aiJudged: { en: "AI-flagged", ko: "AI 판정" },

  recent: { en: "Recent", ko: "최근 케이스" },
  newCase: { en: "New Case", ko: "새 케이스" },
  allCases: { en: "All Cases", ko: "전체 기록" },
  examples: { en: "Examples", ko: "예시" },

  saveNote: { en: "Save as Note", ko: "노트로 저장" },
  savedNote: { en: "Saved to Notes", ko: "노트에 저장됨" },
  retry: { en: "Retry", ko: "다시 시도" },
  opened: { en: "Open", ko: "열림" },
  suggested: { en: "Suggested Questions", ko: "이어서 물어볼 만한 것" },
  ask: { en: "Ask Directly", ko: "직접 물어보기" },
  askButton: { en: "Ask", ko: "묻기" },
  orders: { en: "Orders", ko: "오더" },
  careIndex: { en: "Rx · Dressing · F/U", ko: "처방·드레싱·F/U" },

  copyEmr: { en: "Copy EMR Order", ko: "EMR 오더 복사" },
  handout: { en: "Patient Handout", ko: "환자 안내문" },
  saveSet: { en: "Save as My Set", ko: "내 세트로 저장" },
  redraft: { en: "Redraft", ko: "다시 작성" },
  mySets: { en: "My Sets", ko: "내 세트" },
  addRow: { en: "Add Row", ko: "행 추가" },
  records: { en: "Records", ko: "기록" },
  patients: { en: "Patients", ko: "환자" },
  courses: { en: "Courses", ko: "코스" },
  visits: { en: "Visits", ko: "방문" },
  photos: { en: "Photos", ko: "사진" },
  followUps: { en: "Follow-ups", ko: "F/U 예정" },
  consultLog: { en: "Consult Log", ko: "진료 기록" },
  recordVisit: { en: "Record", ko: "기록에 남기기" },
  editRecord: { en: "Edit record", ko: "기록 수정" },
  consultResult: { en: "Consult result", ko: "진료 결과" },
  patientHistory: { en: "Patient History", ko: "환자 경과" },
  addVisit: { en: "Add Visit", ko: "방문 추가" },
  newCourse: { en: "New Course", ko: "새 코스" },
  dropPhotos: { en: "Drop photos", ko: "사진을 끌어다 놓으세요" },
} satisfies Record<string, BiTerm>;

export const GROUP_TERMS: Record<"safety" | "practice" | "business" | "literature", BiTerm> = {
  safety: { en: "Safety", ko: "안전" },
  practice: { en: "Practice", ko: "실무" },
  business: { en: "Business", ko: "비즈니스" },
  literature: { en: "Literature", ko: "문헌" },
};
