import type { LayerKey } from "./layers";

// What each vessel, nerve, muscle and duct of the atlas looks after and what
// it does. Same review rule as the atlas: standard anatomy, drafted for the
// doctor to check (atlas.ts reviewedBy / reviewedAt covers both).

export interface StructureFunction {
  /** Arteries: area supplied · veins: area drained · nerves: area / muscles
   * innervated · muscles: where it sits and its nerve · ducts: what it carries. */
  territory: string;
  /** What it does, and why that matters chairside. */
  role: string;
}

export const FUNCTION_LAYERS: LayerKey[] = ["arteries", "veins", "nerves", "muscles", "ducts"];

/** Label for `territory`, by layer: English first, Korean under it. */
export const TERRITORY_LABEL: Partial<Record<LayerKey, { en: string; ko: string }>> = {
  arteries: { en: "Supplies", ko: "혈액 공급 부위" },
  veins: { en: "Drains", ko: "배액 부위" },
  nerves: { en: "Innervates", ko: "지배 부위" },
  muscles: { en: "Location · Nerve", ko: "위치 · 지배 신경" },
  ducts: { en: "Carries", ko: "운반" },
};
export const ROLE_LABEL = { en: "Function", ko: "역할" } as const;

export const STRUCTURE_FUNCTIONS: Record<string, StructureFunction> = {
  // ── Arteries ──────────────────────────────────────────────────────────
  "supratrochlear-artery": {
    territory: "이마 중앙·미간의 피부와 근육(추미근, 전두근 내측), 앞쪽 두피",
    role: "안동맥(내경동맥 계열)의 종말 분지. 이마 정중부에 피를 보내고 반대쪽·안와상동맥과 문합합니다. 이 길을 따라 필러가 역류하면 망막동맥까지 닿을 수 있습니다.",
  },
  "supraorbital-artery": {
    territory: "이마 외측, 윗눈꺼풀, 앞쪽~정수리 두피",
    role: "안동맥 분지. 이마 바깥쪽 혈류를 맡고 천측두동맥 전두지와 문합해 내경·외경동맥계를 잇습니다.",
  },
  "superficial-temporal-artery": {
    territory: "관자와 옆머리 두피, 이마 외측(전두지), 귀 앞 피부",
    role: "외경동맥의 종말 분지. 전두지가 안와상동맥과 이어지므로 관자·이마 외측 주입도 안동맥 쪽으로 번질 수 있습니다. 손상 시 출혈·혈종.",
  },
  "deep-temporal-artery": {
    territory: "측두근(앞·뒤 심부측두동맥)",
    role: "상악동맥 분지로 측두근 아래 골막 가까이 지나며 근육에 피를 보냅니다. 관자 골막 위 깊은 주입 때 만나는 혈관입니다.",
  },
  "facial-artery": {
    territory: "입술, 코 옆, 뺨 앞쪽 — 얼굴 앞면 대부분",
    role: "외경동맥 분지로 얼굴 중앙 혈류의 주간선. 상·하순동맥, 외측비동맥을 내고 각동맥으로 이어집니다. 혈관 내 주입 시 넓은 범위의 피부 괴사가 생길 수 있습니다.",
  },
  "superior-labial-artery": {
    territory: "윗입술 전체, 비중격 아래쪽(중격지)",
    role: "안면동맥 분지. 좌우가 정중선에서 만나 입술 동맥고리를 이룹니다. 입술 점막 쪽 깊은 층을 지나 입술 필러에서 가장 주의할 혈관입니다.",
  },
  "inferior-labial-artery": {
    territory: "아랫입술 전체 — 붉은 입술과 그 아래 피부",
    role: "안면동맥 분지로 반대쪽과 문합해 아랫입술 고리를 만듭니다. 아랫입술 볼륨 주입 시 깊이 주의.",
  },
  "lateral-nasal-artery": {
    territory: "콧볼과 코 옆면",
    role: "안면동맥 분지로 배비동맥(안동맥 계열)과 문합합니다. 콧볼·코끝 괴사와 실명 경로가 되는 혈관입니다.",
  },
  "angular-artery": {
    territory: "코 옆벽, 내안각 주변, 눈물고랑 안쪽",
    role: "안면동맥의 종말. 내안각에서 안동맥 분지와 이어져 외경동맥계와 내경동맥계를 연결합니다 — 팔자 상부·눈물고랑 주입이 눈으로 번지는 통로.",
  },
  "dorsal-nasal-artery": {
    territory: "콧등 피부",
    role: "안동맥 분지로 각동맥과 문합합니다. 콧대 필러에서 실명 보고가 가장 많은 경로입니다.",
  },
  "infraorbital-artery": {
    territory: "아래눈꺼풀, 뺨 앞쪽, 코 옆, 윗입술 위쪽",
    role: "상악동맥 분지로 안와하공에서 나와 신경과 함께 퍼집니다. 앞광대·눈밑 골막 위 깊은 주입 때 공 주변을 피해야 하는 이유입니다.",
  },
  "mental-artery": {
    territory: "턱끝과 아랫입술 피부",
    role: "하치조동맥 분지로 이공에서 나와 하순동맥과 문합합니다. 턱끝 주입 시 이공 주변 볼루스 금지.",
  },

  // ── Veins ─────────────────────────────────────────────────────────────
  "angular-vein": {
    territory: "내안각, 코 옆, 이마 안쪽의 정맥혈",
    role: "안면정맥의 시작부. 상안정맥을 통해 해면정맥동과 이어지고 판막이 거의 없어, '위험 삼각' 감염이 머리 안으로 번질 수 있는 길입니다.",
  },
  "facial-vein": {
    territory: "입술, 코, 뺨 등 얼굴 앞면의 정맥혈",
    role: "내경정맥으로 배액합니다. 안면동맥보다 뒤쪽에서 곧게 내려가며, 중안면 깊은 주입 때 멍·혈종의 주원인입니다.",
  },
  "middle-temporal-vein": {
    territory: "관자 부위, 측두근막, 안와 바깥쪽 정맥혈",
    role: "관자 지방층 안을 굵게 지나 천측두정맥으로 합류합니다. 관자 필러가 이 정맥에 들어가면 폐색전까지 보고되어 있습니다.",
  },

  // ── Nerves ────────────────────────────────────────────────────────────
  "supraorbital-nerve": {
    territory: "감각 — 이마, 윗눈꺼풀, 앞쪽~정수리 두피",
    role: "삼차신경 1지(안신경)의 분지로 감각만 담당합니다. 이마 차단마취 부위이고, 손상되면 이마·두피 저림이 남습니다.",
  },
  "infraorbital-nerve": {
    territory: "감각 — 아래눈꺼풀, 뺨 앞쪽, 코 옆, 윗입술",
    role: "삼차신경 2지(상악신경)의 종말로 안와하공에서 나옵니다. 중안면·윗입술 차단마취 지점이며, 손상 시 윗입술·뺨 감각이 떨어집니다.",
  },
  "mental-nerve": {
    territory: "감각 — 아랫입술, 턱끝",
    role: "삼차신경 3지(하악신경) 분지로 아래 소구치 밑 이공에서 나옵니다. 아랫입술 차단마취 지점.",
  },
  "facial-nerve-temporal": {
    territory: "운동 — 전두근, 눈둘레근 위쪽, 추미근",
    role: "안면신경 측두지. 눈썹을 올리는 신경으로, 관자에서 SMAS(측두두정근막) 바로 아래 얕게 지납니다. 손상 시 눈썹 처짐과 이마 주름 소실.",
  },
  "facial-nerve-zygomatic": {
    territory: "운동 — 눈둘레근 아래쪽, 큰광대근 등 광대 주변 근육",
    role: "안면신경 관골지. 눈을 꼭 감고 웃는 근육을 움직입니다. 손상 시 눈 감기가 약해지고 미소가 비대칭이 됩니다.",
  },
  "marginal-mandibular-nerve": {
    territory: "운동 — 입꼬리내림근, 아랫입술내림근, 턱끝근",
    role: "안면신경 하악연지. 아랫입술을 내리는 신경으로 하악연 근처 광경근 아래를 지납니다. 손상 시 웃을 때 아랫입술이 한쪽만 내려가지 않습니다.",
  },

  // ── Muscles ───────────────────────────────────────────────────────────
  frontalis: {
    territory: "이마 전체 · 안면신경 측두지",
    role: "눈썹과 이마를 들어 올려 가로 주름을 만듭니다. 눈썹을 올리는 유일한 근육이라 과한 보톡스는 눈썹 처짐을 부릅니다.",
  },
  corrugator: {
    territory: "미간 · 안면신경 측두지",
    role: "눈썹을 안쪽·아래로 당겨 미간 세로 주름(11자)을 만듭니다. 미간 보톡스의 주 타깃.",
  },
  procerus: {
    territory: "미간~콧등 위쪽 · 안면신경 측두지",
    role: "눈썹 안쪽을 아래로 당겨 콧등 위 가로 주름을 만듭니다. 미간 보톡스 때 함께 맞히는 근육.",
  },
  "orbicularis-oculi": {
    territory: "눈 둘레 · 안면신경 측두지·관골지",
    role: "눈을 감고 깜빡이게 합니다. 바깥쪽 수축이 눈가 잔주름(까마귀발)을 만들어 눈가 보톡스 부위가 됩니다.",
  },
  "levator-labii": {
    territory: "코 옆~윗입술 · 안면신경 관골·협근지",
    role: "윗입술과 콧볼을 들어 올립니다. 과하면 잇몸 미소와 팔자 상부 깊이를 만들어 잇몸 미소 보톡스 부위입니다.",
  },
  "zygomaticus-major": {
    territory: "광대뼈 → 입꼬리 · 안면신경 관골·협근지",
    role: "입꼬리를 위·바깥으로 당겨 웃게 합니다. 눈가·광대 보톡스가 여기로 번지면 미소가 비대칭이 됩니다.",
  },
  "orbicularis-oris": {
    territory: "입술 둘레 · 안면신경 협근지·하악연지",
    role: "입을 다물고 오므립니다. 반복 수축이 입술 주위 세로 주름을 만들고, 입술 보톡스는 소량만 씁니다(발음·빨대 사용 영향).",
  },
  "depressor-anguli-oris": {
    territory: "입꼬리 아래 · 안면신경 하악연지",
    role: "입꼬리를 아래로 당겨 처진 입꼬리·마리오네트 라인을 만듭니다. DAO 보톡스 부위.",
  },
  mentalis: {
    territory: "턱끝 · 안면신경 하악연지",
    role: "턱끝을 올리고 아랫입술을 내밀게 합니다. 과하면 턱끝이 오돌토돌(조약돌 턱)해져 턱끝 보톡스 부위가 됩니다.",
  },
  masseter: {
    territory: "광대궁 → 하악각 · 삼차신경 3지(교근신경)",
    role: "턱을 다물고 씹는 힘의 중심입니다. 비대하면 사각턱이 되어 교근 보톡스 부위가 되고, 너무 앞쪽에 맞히면 웃을 때 볼이 꺼집니다.",
  },
  temporalis: {
    territory: "관자 · 삼차신경 3지(심측두신경)",
    role: "턱을 올리고 뒤로 당겨 씹기를 돕습니다. 이갈이·두통 보톡스 부위이며, 근육 위아래가 관자 필러의 층 기준이 됩니다.",
  },

  // ── Ducts ─────────────────────────────────────────────────────────────
  "parotid-duct": {
    territory: "이하선에서 만든 침 → 윗 둘째 큰어금니 맞은편 입안",
    role: "침을 입안으로 내보내는 관(스텐슨관). 교근 앞을 지나 협근을 뚫으므로, 손상 시 침샘루·부종이 생길 수 있습니다.",
  },
};

export function structureFunction(id: string): StructureFunction | undefined {
  return STRUCTURE_FUNCTIONS[id];
}
