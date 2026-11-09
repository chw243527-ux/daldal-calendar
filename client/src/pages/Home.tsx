import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Cloud,
  Copy,
  GitMerge,
  History,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  ImageDown,
  Landmark,
  LayoutGrid,
  ListChecks,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  Repeat2,
  Settings2,
  Sparkles,
  Trash2,
  Wallet,
  WalletCards,
  Users,
  X,
} from "lucide-react";
import { syncNativeWidget } from "@/lib/widget";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { createMonthlyWallpaper, downloadWallpaper, openNativeLiveWallpaperSettings, setNativeLockScreenWallpaper } from "@/lib/wallpaper";

type ItemType = "todo" | "event" | "income" | "expense" | "loan" | "savings";
type View = "home" | "calendar" | "ledger" | "report";

type CalendarItem = {
  id: string;
  type: ItemType;
  title: string;
  date: string;
  time?: string;
  amount?: number;
  category?: string;
  note?: string;
  completed?: boolean;
  loanPrincipal?: number;
  interestRate?: number;
  gracePeriod?: number;
  repaymentDate?: string;
  repaymentMethod?: "equalPayment" | "equalPrincipal";
  termMonths?: number;
  sourceLoanId?: string;
  paymentNumber?: number;
  principalPaid?: number;
  interestPaid?: number;
  remainingBalance?: number;
  recurrence?: "none" | "monthly";
  repeatUntil?: string;
  owner?: string;
  accentColor?: string;
  cardCompany?: string;
  cardMode?: "lumpSum" | "installment";
  installments?: number;
  cardFeeRate?: number;
  savingsMaturityDate?: string;
  savingsInterestRate?: number;
  savingsTermMonths?: number;
  assetKind?: "account" | "card" | "cash" | "savings" | "loan" | "localCurrency" | "other";
  assetName?: string;
  paymentMethod?: "card" | "cash" | "account" | "localCurrency" | "other";
  localCurrencyDiscountRate?: number;
  localCurrencySource?: string;
  localCurrencyTarget?: string;
  localCurrencyLoadedAmount?: number;
  localCurrencyCashbackRate?: number;
  localCurrencyCashbackAmount?: number;
  updatedAt?: string;
};

type AssetBalance = {
  id: string;
  kind: "account" | "cash" | "localCurrency";
  name: string;
  initialBalance: number;
  owner: string;
};

type Draft = {
  type: ItemType;
  title: string;
  date: string;
  time: string;
  amount: string;
  category: string;
  note: string;
  loanPrincipal: string;
  interestRate: string;
  gracePeriod: string;
  repaymentDate: string;
  repaymentMethod: "equalPayment" | "equalPrincipal";
  termMonths: string;
  recurrence: "none" | "monthly";
  repeatUntil: string;
  owner: string;
  accentColor: string;
  cardCompany: string;
  cardMode: "lumpSum" | "installment";
  installments: string;
  cardFeeRate: string;
  savingsMaturityDate: string;
  savingsInterestRate: string;
  savingsTermMonths: string;
  assetKind: "account" | "card" | "cash" | "savings" | "loan" | "localCurrency" | "other";
  assetName: string;
  paymentMethod: "card" | "cash" | "account" | "localCurrency" | "other";
  localCurrencyDiscountRate: string;
  localCurrencySource: string;
  localCurrencyTarget: string;
  localCurrencyCashbackRate: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "daldal-calendar-items";
const CATEGORY_STORAGE_KEY = "daldal-calendar-custom-categories";
const BUDGET_STORAGE_KEY = "daldal-calendar-monthly-budgets";
const RESERVE_STORAGE_KEY = "daldal-calendar-emergency-reserve";
const ASSET_BALANCE_STORAGE_KEY = "daldal-calendar-asset-balances";
type CategoryMap = Record<ItemType, string[]>;

const typeMeta: Record<ItemType, { label: string; color: string; soft: string; icon: LucideIcon }> = {
  todo: { label: "할 일", color: "#6f63b6", soft: "#f0edff", icon: ClipboardCheck },
  event: { label: "일정", color: "#e98272", soft: "#fff0ed", icon: CalendarDays },
  income: { label: "수입", color: "#4c9d83", soft: "#e8f7f0", icon: ArrowUpRight },
  expense: { label: "지출", color: "#d87568", soft: "#fff0ed", icon: ArrowDownRight },
  loan: { label: "대출", color: "#b8894d", soft: "#fff6e5", icon: Landmark },
  savings: { label: "적금", color: "#5ca9d6", soft: "#eaf7ff", icon: Wallet },
};

const categories: Record<ItemType, string[]> = {
  todo: ["개인", "업무", "집안일", "쇼핑"],
  event: ["약속", "업무", "건강", "가족"],
  income: ["급여", "용돈", "부수입", "환급"],
  expense: ["식비", "교통", "쇼핑", "구독", "생활", "지역화폐 충전"],
  loan: ["대출", "카드값", "할부", "저축"],
  savings: ["적금", "목돈", "여행", "주택"],
};
const CARD_COMPANIES = ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "우리카드", "하나카드", "NH농협카드"];
const ASSET_KINDS = [{ value: "account", label: "계좌" }, { value: "card", label: "카드" }, { value: "cash", label: "현금" }, { value: "savings", label: "적금" }, { value: "loan", label: "대출" }, { value: "localCurrency", label: "지역화폐" }, { value: "other", label: "기타" }] as const;
const PAYMENT_METHODS = [{ value: "card", label: "카드" }, { value: "cash", label: "현금" }, { value: "account", label: "계좌이체" }, { value: "localCurrency", label: "지역화폐" }, { value: "other", label: "기타" }] as const;
const CARD_BENEFITS: Record<string, { threshold: number; cap: number; categories: string[] }> = {
  "신한카드": { threshold: 300000, cap: 10000, categories: ["식비", "교통", "쇼핑", "생활"] },
  "삼성카드": { threshold: 300000, cap: 12000, categories: ["식비", "쇼핑", "생활"] },
  "현대카드": { threshold: 500000, cap: 15000, categories: ["식비", "교통", "쇼핑"] },
  "KB국민카드": { threshold: 300000, cap: 10000, categories: ["식비", "교통", "생활"] },
  "롯데카드": { threshold: 300000, cap: 10000, categories: ["식비", "쇼핑", "구독"] },
  "우리카드": { threshold: 300000, cap: 10000, categories: ["식비", "교통", "생활"] },
  "하나카드": { threshold: 300000, cap: 10000, categories: ["식비", "쇼핑", "구독"] },
  "NH농협카드": { threshold: 300000, cap: 10000, categories: ["식비", "교통", "생활"] },
};
const CARD_RATE_SOURCES: Record<string, { rates: Record<number, number>; basis: string }> = {
  "신한카드": { rates: { 2: 12.5, 3: 17.5, 4: 17.9, 5: 17.9, 6: 18.9, 7: 18.9, 8: 18.9, 9: 18.9 }, basis: "공식 이용안내 연간 할부수수료율 · 확인일 2026-11-09" },
};

function getOfficialCardRate(company: string, installments: number) {
  return CARD_RATE_SOURCES[company]?.rates[installments];
}

function getCardRateBasis(company: string, installments: number) {
  if (getOfficialCardRate(company, installments) !== undefined) return CARD_RATE_SOURCES[company].basis;
  return "회원·상품·가맹점별 실제 요율을 카드사에서 확인해 입력해 주세요.";
}

const aiCategoryKeywords: Partial<Record<ItemType, Record<string, string[]>>> = {
  income: { "급여": ["월급", "급여", "연봉", "보너스", "상여"], "용돈": ["용돈", "생활비"], "부수입": ["판매", "알바", "프리랜서", "부수입", "이자"], "환급": ["환급", "캐시백", "취소", "돌려받"] },
  expense: { "식비": ["점심", "저녁", "아침", "식사", "밥", "카페", "커피", "배달", "치킨", "맥주", "식비", "마트"], "교통": ["교통", "택시", "버스", "지하철", "주유", "주차", "기차", "항공"], "쇼핑": ["쇼핑", "쿠팡", "선물", "옷", "신발", "온라인", "마켓"], "구독": ["구독", "넷플릭스", "유튜브", "멤버십", "정기결제"], "생활": ["관리비", "전기", "가스", "통신", "병원", "약국", "생활", "세탁"], "지역화폐 충전": ["지역화폐", "지역상품권", "충전"] },
  loan: { "대출": ["대출", "이자", "은행", "상환"], "카드값": ["카드", "카드값", "결제대금"], "할부": ["할부", "리볼빙"], "저축": ["저축", "적금", "예금", "투자"] },
};

function aiSuggestCategory(type: ItemType, text: string, categoryMap: CategoryMap = categories) {
  const keywordGroups = { ...(aiCategoryKeywords[type] ?? {}) } as Record<string, string[]>;
  categoryMap[type].filter((category) => !keywordGroups[category]).forEach((category) => { keywordGroups[category] = [category]; });
  if (!text.trim()) return { category: categoryMap[type][0], confidence: 0, reason: "제목을 입력하면 자동으로 추천해요" };
  const normalized = text.toLowerCase();
  let best = { category: categories[type][0], score: 0, keyword: "" };
  Object.entries(keywordGroups).forEach(([category, keywords]) => {
    keywords.forEach((keyword) => {
      if (normalized.includes(keyword.toLowerCase()) && keyword.length > best.score) best = { category, score: keyword.length, keyword };
    });
  });
  return best.score ? { category: best.category, confidence: Math.min(96, 62 + best.score * 5), reason: `“${best.keyword}” 키워드로 ${best.category} 추천` } : { category: categories[type][0], confidence: 38, reason: "내용을 바탕으로 기본 카테고리를 추천했어요" };
}

const pad = (value: number) => String(value).padStart(2, "0");

function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromISO(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(date: Date, amount: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

function calculateLoanSchedule(item: CalendarItem): CalendarItem[] {
  if (item.type !== "loan" || !item.loanPrincipal || item.interestRate === undefined || !item.repaymentDate || !item.termMonths) return [];
  const principal = item.loanPrincipal;
  const monthlyRate = item.interestRate / 100 / 12;
  const graceMonths = Math.max(0, item.gracePeriod ?? 0);
  const repaymentMonths = Math.max(1, item.termMonths);
  const fixedPayment = item.repaymentMethod === "equalPrincipal"
    ? principal / repaymentMonths
    : monthlyRate === 0 ? principal / repaymentMonths : principal * monthlyRate * ((1 + monthlyRate) ** repaymentMonths) / (((1 + monthlyRate) ** repaymentMonths) - 1);
  let balance = principal;
  const schedule: CalendarItem[] = [];
  for (let index = 1; index <= graceMonths + repaymentMonths; index += 1) {
    const isGrace = index <= graceMonths;
    const interest = Math.round(balance * monthlyRate);
    const principalPaid = isGrace ? 0 : Math.min(balance, index === graceMonths + repaymentMonths ? balance : Math.round(item.repaymentMethod === "equalPrincipal" ? principal / repaymentMonths : fixedPayment - interest));
    const amount = interest + principalPaid;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ ...item, id: `${item.id}-schedule-${index}`, sourceLoanId: item.id, title: isGrace ? `${item.title} · 거치 ${index}회차` : `${item.title} · ${index - graceMonths}회차`, date: toISO(addMonths(fromISO(item.repaymentDate), index - 1)), amount, note: `${isGrace ? "거치기간 이자" : item.repaymentMethod === "equalPrincipal" ? "원금균등 상환" : "원리금균등 상환"} · 원금 ${formatWon(principalPaid)} · 이자 ${formatWon(interest)} · 잔액 ${formatWon(balance)}`, paymentNumber: index, principalPaid, interestPaid: interest, remainingBalance: balance });
  }
  return schedule;
}

function getDisplayItems(items: CalendarItem[]) {
  return items.flatMap((item) => {
    if (item.type === "loan" && item.termMonths && item.loanPrincipal) {
      const schedule = calculateLoanSchedule(item);
      return schedule.length ? schedule : [item];
    }
    if (item.recurrence === "monthly" && item.repeatUntil) {
      const recurring: CalendarItem[] = [];
      const start = fromISO(item.date);
      const end = fromISO(item.repeatUntil);
      for (let cursor = new Date(start), index = 0; cursor <= end; cursor = addMonths(cursor, 1), index += 1) {
        recurring.push({ ...item, id: `${item.id}-repeat-${index}`, sourceLoanId: item.id, date: toISO(cursor), title: index ? `${item.title} · ${index + 1}회차` : item.title });
      }
      return recurring;
    }
    return [item];
  });
}

function formatWon(value = 0) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatCompact(value = 0) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${value < 0 ? "−" : ""}${(abs / 100000000).toFixed(1).replace(".0", "")}억`;
  if (abs >= 10000) return `${value < 0 ? "−" : ""}${(abs / 10000).toFixed(1).replace(".0", "")}만`;
  return `${value < 0 ? "−" : ""}${new Intl.NumberFormat("ko-KR").format(abs)}`;
}

function formatLongDate(value: string) {
  return fromISO(value).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function monthShortLabel(date: Date) {
  return date.toLocaleDateString("ko-KR", { month: "long" }).replace("월", "");
}

function seedItems(today: Date): CalendarItem[] {
  const date = (offset: number) => toISO(addDays(today, offset));
  return [
    { id: "seed-todo", type: "todo", title: "이번 주 식비 정리", date: date(0), category: "집안일" },
    { id: "seed-event", type: "event", title: "팀 주간 싱크", date: date(0), time: "14:00", category: "업무" },
    { id: "seed-lunch", type: "expense", title: "점심 식사", date: date(0), amount: 12000, category: "식비" },
    { id: "seed-salary", type: "income", title: "월급", date: date(-3), amount: 2800000, category: "급여" },
    { id: "seed-transit", type: "expense", title: "교통카드 충전", date: date(1), amount: 50000, category: "교통" },
    { id: "seed-pilates", type: "event", title: "필라테스", date: date(2), time: "19:30", category: "건강" },
    { id: "seed-gift", type: "todo", title: "친구 생일 선물 고르기", date: date(3), category: "쇼핑" },
    { id: "seed-loan", type: "loan", title: "카카오뱅크 상환", date: date(5), amount: 220000, category: "대출" },
    { id: "seed-subscription", type: "expense", title: "스트리밍 구독", date: date(7), amount: 17000, category: "구독" },
  ];
}

function getMonthItems(items: CalendarItem[], date: Date) {
  const prefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return items.filter((item) => item.date.startsWith(prefix));
}

function createDraft(date: string, type: ItemType = "todo", categoryMap: CategoryMap = categories): Draft {
  return {
    type,
    title: "",
    date,
    time: type === "event" ? "12:00" : "",
    amount: "",
    category: categoryMap[type][0],
    note: "",
    loanPrincipal: "",
    interestRate: "",
    gracePeriod: "0",
    repaymentDate: date,
    repaymentMethod: "equalPayment",
    termMonths: "60",
    recurrence: "none",
    repeatUntil: "",
    owner: "나",
    accentColor: type === "todo" ? "#6f63b6" : type === "event" ? "#e98272" : "",
    cardCompany: CARD_COMPANIES[0],
    cardMode: "lumpSum",
    installments: "2",
    cardFeeRate: "0",
    savingsMaturityDate: "",
    savingsInterestRate: "",
    savingsTermMonths: "12",
    assetKind: type === "loan" ? "loan" : type === "savings" ? "savings" : type === "expense" ? "card" : "account",
    assetName: "",
    paymentMethod: "card",
    localCurrencyDiscountRate: "10",
    localCurrencySource: "",
    localCurrencyTarget: "지역화폐",
    localCurrencyCashbackRate: "0",
  };
}

function isLocalCurrencyTransfer(item: CalendarItem) {
  return item.type === "expense" && item.category === "지역화폐 충전";
}

function getCalendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? new Date(year, monthIndex, day) : null;
  });
}

function CalendarItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: CalendarItem;
  onToggle: (item: CalendarItem) => void;
  onEdit: (item: CalendarItem) => void;
}) {
  const meta = typeMeta[item.type];
  const Icon = meta.icon;
  const isFinance = ["income", "expense", "loan"].includes(item.type);
  return (
    <button className={`item-row ${item.completed ? "is-complete" : ""}`} onClick={() => onEdit(item)} type="button">
      <span className="item-icon" style={{ backgroundColor: meta.soft, color: meta.color }}>
        <Icon size={16} strokeWidth={2.3} />
      </span>
      <span className="item-copy">
        <span className="item-title">{item.title}</span>
        <span className="item-meta">
          {meta.label}{item.category ? ` · ${item.category}` : ""}{item.time ? ` · ${item.time}` : ""}{item.paymentNumber ? ` · ${item.paymentNumber}회차 · 원금 ${formatCompact(item.principalPaid)} · 이자 ${formatCompact(item.interestPaid)}` : ""}
        </span>
      </span>
      {isFinance && <span className={`item-amount ${item.type === "income" ? "positive" : ""}`}>{item.type === "income" ? "+" : "−"}{formatCompact(item.amount)}</span>}
      {item.type === "todo" && (
        <span
          className={`check-control ${item.completed ? "checked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(item);
          }}
          role="checkbox"
          aria-checked={item.completed}
          aria-label={item.completed ? "완료 취소" : "할 일 완료"}
        >
          {item.completed && <Check size={13} strokeWidth={3} />}
        </span>
      )}
      <ChevronRight className="row-arrow" size={16} />
    </button>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);
  const auth = useAuth();
  const familyQuery = trpc.family.get.useQuery(undefined, { enabled: auth.isAuthenticated, refetchInterval: auth.isAuthenticated ? 5000 : false });
  const familyCreate = trpc.family.create.useMutation();
  const familyJoin = trpc.family.join.useMutation();
  const familySync = trpc.family.sync.useMutation();
  const familyRestore = trpc.family.restore.useMutation();
  const [view, setView] = useState<View>("home");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [items, setItems] = useState<CalendarItem[]>(() => seedItems(today));
  const [customCategories, setCustomCategories] = useState<Partial<Record<ItemType, string[]>>>({ income: [], expense: [], loan: [] });
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, { expense: number; loan: number; categories?: Record<string, number> }>>({});
  const [emergencyReserve, setEmergencyReserve] = useState(0);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => createDraft(todayISO));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [isGeneratingWallpaper, setIsGeneratingWallpaper] = useState(false);
  const [wallpaperMessage, setWallpaperMessage] = useState<string | null>(null);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [isAssetManagerOpen, setAssetManagerOpen] = useState(false);
  const [isFamilyOpen, setFamilyOpen] = useState(false);
  const [familyName, setFamilyName] = useState("우리 가족 가계부");
  const [familyInviteCode, setFamilyInviteCode] = useState("");
  const [familyMessage, setFamilyMessage] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{ version: number; remoteRecords: CalendarItem[] } | null>(null);
  const lastFamilySignature = useRef<string | null>(null);
  const lastSyncedRecords = useRef<string | null>(null);
  const categoryMap = useMemo<CategoryMap>(() => ({
    ...categories,
    income: [...categories.income, ...(customCategories.income ?? [])],
    expense: [...categories.expense, ...(customCategories.expense ?? [])],
    loan: [...categories.loan, ...(customCategories.loan ?? [])],
  }), [customCategories]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
      const savedCategories = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (savedCategories) setCustomCategories(JSON.parse(savedCategories));
      const savedBudgets = window.localStorage.getItem(BUDGET_STORAGE_KEY);
      if (savedBudgets) setMonthlyBudgets(JSON.parse(savedBudgets));
      const savedReserve = window.localStorage.getItem(RESERVE_STORAGE_KEY);
      if (savedReserve) setEmergencyReserve(Number(savedReserve) || 0);
      const savedAssets = window.localStorage.getItem(ASSET_BALANCE_STORAGE_KEY);
      if (savedAssets) setAssetBalances(JSON.parse(savedAssets) as AssetBalance[]);
    } catch {
      // Keep the starter entries if local storage is unavailable.
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, isLoaded]);

  useEffect(() => {
    const remote = familyQuery.data;
    if (!isLoaded || !remote || conflictState || lastFamilySignature.current === remote.updatedAt) return;
    const remoteRecords = Array.isArray(remote.records) ? remote.records as CalendarItem[] : [];
    lastFamilySignature.current = remote.updatedAt;
    lastSyncedRecords.current = JSON.stringify(remoteRecords);
    if (remoteRecords.length > 0 || items.length === 0) setItems(remoteRecords);
  }, [familyQuery.data, isLoaded, conflictState]);

  useEffect(() => {
    if (!isLoaded || !familyQuery.data || conflictState || familySync.isPending) return;
    const currentFamily = familyQuery.data;
    const signature = JSON.stringify(items);
    if (signature === lastSyncedRecords.current) return;
    const timer = window.setTimeout(() => {
      familySync.mutate({ records: items, baseVersion: currentFamily.version }, { onSuccess: (result) => {
        if (result.conflict) setConflictState({ version: result.version, remoteRecords: result.records as CalendarItem[] });
        else lastSyncedRecords.current = signature;
      } });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [items, isLoaded, familyQuery.data, familySync.isPending, conflictState]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
  }, [customCategories, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(monthlyBudgets));
  }, [monthlyBudgets, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(RESERVE_STORAGE_KEY, String(emergencyReserve));
  }, [emergencyReserve, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(ASSET_BALANCE_STORAGE_KEY, JSON.stringify(assetBalances));
  }, [assetBalances, isLoaded]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const displayItems = useMemo(() => getDisplayItems(items), [items]);
  const monthItems = useMemo(() => getMonthItems(displayItems, month), [displayItems, month]);
  const localCurrencyBalances = useMemo(() => displayItems.reduce<Record<string, number>>((balances, item) => {
    const target = item.localCurrencyTarget || (item.paymentMethod === "localCurrency" ? item.assetName : undefined);
    if (!target) return balances;
    const amount = item.category === "지역화폐 충전" ? (item.localCurrencyLoadedAmount ?? item.amount ?? 0) : item.paymentMethod === "localCurrency" ? -(item.amount ?? 0) + (item.localCurrencyCashbackAmount ?? 0) : 0;
    return { ...balances, [target]: (balances[target] ?? 0) + amount };
  }, {}), [displayItems]);
  const monthlyCardSpend = useMemo(() => monthItems.filter((item) => item.type === "expense" && !isLocalCurrencyTransfer(item) && item.paymentMethod === "card" && item.cardCompany).reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.cardCompany as string]: (totals[item.cardCompany as string] ?? 0) + (item.amount ?? 0) }), {}), [monthItems]);
  const selectedItems = useMemo(() => displayItems.filter((item) => item.date === selectedDate), [displayItems, selectedDate]);
  const todayItems = useMemo(() => displayItems.filter((item) => item.date === todayISO), [displayItems, todayISO]);
  const monthSummary = useMemo(() => {
    const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const expense = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !isLocalCurrencyTransfer(item)).reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const loan = monthItems.filter((item) => item.type === "loan").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return { income, expense, loan, balance: income - expense - loan };
  }, [monthItems]);

  const todayTodos = todayItems.filter((item) => item.type === "todo");
  const todayEvents = todayItems.filter((item) => item.type === "event");
  const nextItems = displayItems
    .filter((item) => item.date > todayISO && (item.type === "event" || item.type === "todo"))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  useEffect(() => {
    void syncNativeWidget({
      todoCount: todayTodos.filter((item) => !item.completed).length,
      eventCount: todayEvents.length,
      balance: monthSummary.balance,
      dateLabel: formatLongDate(todayISO),
      monthLabel: monthLabel(month),
      calendarItems: displayItems.map(({ type, title, date, time, amount, completed, category, localCurrencyDiscountRate, localCurrencyTarget, localCurrencyCashbackRate, localCurrencyCashbackAmount }) => ({ type, title, date, time, amount, completed, category, localCurrencyDiscountRate, localCurrencyTarget, localCurrencyCashbackRate, localCurrencyCashbackAmount })),
    });
  }, [todayISO, todayTodos, todayEvents, monthSummary.balance, month, displayItems]);

  const openCreate = (type: ItemType = "todo", date = selectedDate) => {
    setEditingId(null);
    setDraft(createDraft(date, type, categoryMap));
    setComposerOpen(true);
  };

  const openEdit = (item: CalendarItem) => {
    const sourceItem = item.sourceLoanId ? items.find((candidate) => candidate.id === item.sourceLoanId) ?? item : item;
    setEditingId(sourceItem.id);
    setDraft({
      type: sourceItem.type,
      title: sourceItem.title,
      date: sourceItem.date,
      time: sourceItem.time ?? "",
      amount: sourceItem.amount ? String(sourceItem.amount) : "",
      category: sourceItem.category ?? categoryMap[sourceItem.type][0],
      note: sourceItem.note ?? "",
      loanPrincipal: sourceItem.loanPrincipal ? String(sourceItem.loanPrincipal) : "",
      interestRate: sourceItem.interestRate ? String(sourceItem.interestRate) : "",
      gracePeriod: sourceItem.gracePeriod ? String(sourceItem.gracePeriod) : "0",
      repaymentDate: sourceItem.repaymentDate ?? sourceItem.date,
      repaymentMethod: sourceItem.repaymentMethod ?? "equalPayment",
      termMonths: sourceItem.termMonths ? String(sourceItem.termMonths) : "60",
      recurrence: sourceItem.recurrence ?? "none",
      repeatUntil: sourceItem.repeatUntil ?? "",
      owner: sourceItem.owner ?? "나",
      accentColor: sourceItem.accentColor ?? (sourceItem.type === "todo" ? "#6f63b6" : "#e98272"),
      cardCompany: sourceItem.cardCompany ?? CARD_COMPANIES[0],
      cardMode: sourceItem.cardMode ?? "lumpSum",
      installments: sourceItem.installments ? String(sourceItem.installments) : "2",
      cardFeeRate: sourceItem.cardFeeRate ? String(sourceItem.cardFeeRate) : "0",
      savingsMaturityDate: sourceItem.savingsMaturityDate ?? "",
      savingsInterestRate: sourceItem.savingsInterestRate ? String(sourceItem.savingsInterestRate) : "",
      savingsTermMonths: sourceItem.savingsTermMonths ? String(sourceItem.savingsTermMonths) : "12",
      assetKind: sourceItem.assetKind ?? (sourceItem.type === "loan" ? "loan" : sourceItem.type === "savings" ? "savings" : sourceItem.type === "expense" ? "card" : "account"),
      assetName: sourceItem.assetName ?? "",
      paymentMethod: sourceItem.paymentMethod ?? "card",
      localCurrencyDiscountRate: sourceItem.localCurrencyDiscountRate ? String(sourceItem.localCurrencyDiscountRate) : "10",
      localCurrencySource: sourceItem.localCurrencySource ?? "",
      localCurrencyTarget: sourceItem.localCurrencyTarget ?? "지역화폐",
      localCurrencyCashbackRate: sourceItem.localCurrencyCashbackRate ? String(sourceItem.localCurrencyCashbackRate) : "0",
    });
    setComposerOpen(true);
  };

  const saveItem = () => {
    if (!draft.title.trim()) return;
    const isLocalCurrency = draft.type === "expense" && draft.category === "지역화폐 충전";
    const isLocalCurrencyPurchase = draft.type === "expense" && draft.paymentMethod === "localCurrency";
    const localCurrencyRate = isLocalCurrency ? Math.min(100, Math.max(0, Number(draft.localCurrencyDiscountRate || 0))) : undefined;
    const localCurrencyLoadedAmount = isLocalCurrency ? Math.round(Number(draft.amount || 0) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)) : undefined;
    const localCurrencyCashbackRate = isLocalCurrencyPurchase ? Math.min(100, Math.max(0, Number(draft.localCurrencyCashbackRate || 0))) : undefined;
    const localCurrencyCashbackAmount = isLocalCurrencyPurchase ? Math.round(Number(draft.amount || 0) * Number(localCurrencyCashbackRate || 0) / 100) : undefined;
    const nextItem: CalendarItem = {
      id: editingId ?? `item-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      type: draft.type,
      title: draft.title.trim(),
      date: draft.date,
      time: draft.type === "event" ? draft.time : undefined,
      amount: ["income", "expense", "loan", "savings"].includes(draft.type) && draft.amount ? Number(draft.amount.replace(/,/g, "")) : undefined,
      category: draft.category,
      note: draft.note.trim() || undefined,
      completed: editingId ? items.find((item) => item.id === editingId)?.completed : false,
      loanPrincipal: draft.type === "loan" && draft.loanPrincipal ? Number(draft.loanPrincipal.replace(/,/g, "")) : undefined,
      interestRate: draft.type === "loan" && draft.interestRate ? Number(draft.interestRate) : undefined,
      gracePeriod: draft.type === "loan" && draft.gracePeriod ? Number(draft.gracePeriod) : undefined,
      repaymentDate: draft.type === "loan" ? draft.repaymentDate : undefined,
      repaymentMethod: draft.type === "loan" ? draft.repaymentMethod : undefined,
      termMonths: draft.type === "loan" && draft.termMonths ? Number(draft.termMonths) : undefined,
      recurrence: ["expense", "loan", "savings"].includes(draft.type) ? (draft.type === "savings" ? "monthly" : draft.recurrence) : undefined,
      repeatUntil: ["expense", "loan", "savings"].includes(draft.type) && (draft.type === "savings" || draft.recurrence === "monthly") ? draft.type === "savings" ? draft.savingsMaturityDate || toISO(addMonths(fromISO(draft.date), Math.max(1, Number(draft.savingsTermMonths || 12)) - 1)) : draft.repeatUntil : undefined,
      owner: ["income", "expense", "loan", "savings"].includes(draft.type) ? draft.owner : undefined,
      accentColor: ["todo", "event"].includes(draft.type) ? draft.accentColor : undefined,
      cardCompany: draft.type === "expense" && draft.paymentMethod === "card" ? draft.cardCompany : draft.type === "loan" && draft.category === "카드값" ? draft.cardCompany : undefined,
      cardMode: draft.type === "loan" && draft.category === "카드값" ? draft.cardMode : undefined,
      installments: draft.type === "loan" && draft.category === "카드값" ? Number(draft.installments) : undefined,
      cardFeeRate: draft.type === "loan" && draft.category === "카드값" ? Number(draft.cardFeeRate) : undefined,
      savingsMaturityDate: draft.type === "savings" ? draft.savingsMaturityDate || undefined : undefined,
      savingsInterestRate: draft.type === "savings" && draft.savingsInterestRate ? Number(draft.savingsInterestRate) : undefined,
      savingsTermMonths: draft.type === "savings" && draft.savingsTermMonths ? Number(draft.savingsTermMonths) : undefined,
      assetKind: isLocalCurrency ? "account" : isLocalCurrencyPurchase ? "localCurrency" : ["income", "expense", "loan", "savings"].includes(draft.type) ? draft.assetKind : undefined,
      assetName: isLocalCurrency ? draft.localCurrencySource.trim() || draft.assetName.trim() || "주거래 계좌" : isLocalCurrencyPurchase ? draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐" : ["income", "expense", "loan", "savings"].includes(draft.type) && draft.assetName.trim() ? draft.assetName.trim() : undefined,
      paymentMethod: isLocalCurrency ? "account" : draft.type === "expense" ? draft.paymentMethod : undefined,
      localCurrencyDiscountRate: localCurrencyRate,
      localCurrencySource: isLocalCurrency ? draft.localCurrencySource.trim() || draft.assetName.trim() || "주거래 계좌" : undefined,
      localCurrencyTarget: isLocalCurrency || isLocalCurrencyPurchase ? draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐" : undefined,
      localCurrencyLoadedAmount,
      localCurrencyCashbackRate,
      localCurrencyCashbackAmount,
    };

    setItems((current) => editingId ? current.map((item) => item.id === editingId ? nextItem : item) : [nextItem, ...current]);
    setSelectedDate(draft.date);
    const nextMonth = new Date(`${draft.date}T12:00:00`);
    nextMonth.setDate(1);
    setMonth(nextMonth);
    setComposerOpen(false);
  };

  const deleteItem = () => {
    if (!editingId) return;
    setItems((current) => current.filter((item) => item.id !== editingId));
    setComposerOpen(false);
  };

  const toggleTodo = (item: CalendarItem) => {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry));
  };

  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(toISO(next));
  };

  const setViewAndScroll = (nextView: View) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generateWallpaper = async () => {
    setIsGeneratingWallpaper(true);
    setWallpaperMessage(null);
    try {
      const dataUrl = await createMonthlyWallpaper({ month, items, ...monthSummary });
      const appliedNatively = await setNativeLockScreenWallpaper(dataUrl);
      if (!appliedNatively) downloadWallpaper(dataUrl, month);
      setWallpaperMessage(appliedNatively ? "잠금화면 배경으로 적용했어요." : "월간 달력 이미지를 저장했어요. 잠금화면으로 설정해 보세요.");
    } catch {
      setWallpaperMessage("배경 이미지를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setIsGeneratingWallpaper(false);
      window.setTimeout(() => setWallpaperMessage(null), 4200);
    }
  };

  const openLiveWallpaper = async () => {
    try {
      const opened = await openNativeLiveWallpaperSettings();
      setWallpaperMessage(opened ? "잠금화면을 선택한 뒤 적용해 주세요." : "라이브 배경화면은 설치된 Android 앱에서 사용할 수 있어요.");
    } catch {
      setWallpaperMessage("라이브 배경화면 설정을 열지 못했어요.");
    }
    window.setTimeout(() => setWallpaperMessage(null), 4200);
  };

  const createFamilySpace = async () => {
    try {
      const space = await familyCreate.mutateAsync({ name: familyName });
      await familyQuery.refetch();
      if (items.length) familySync.mutate({ records: items, baseVersion: 1 });
      setFamilyMessage(`공유 공간을 만들었어요. 초대 코드 ${space.inviteCode}`);
    } catch { setFamilyMessage("공유 공간을 만들지 못했어요. 로그인 상태와 서버 연결을 확인해 주세요."); }
  };

  const joinFamilySpace = async () => {
    try {
      await familyJoin.mutateAsync({ inviteCode: familyInviteCode });
      await familyQuery.refetch();
      setFamilyInviteCode("");
      setFamilyMessage("가족 공유 공간에 참여했어요. 최신 장부를 불러옵니다.");
    } catch { setFamilyMessage("초대 코드를 확인해 주세요."); }
  };

  const copyFamilyCode = async () => {
    if (!familyQuery.data?.inviteCode) return;
    await navigator.clipboard?.writeText(familyQuery.data.inviteCode);
    setFamilyMessage("초대 코드를 복사했어요.");
  };

  const resolveConflict = (mode: "local" | "remote" | "merge") => {
    if (!conflictState) return;
    const local = items;
    const remote = conflictState.remoteRecords;
    const next = mode === "local" ? local : mode === "remote" ? remote : Array.from(new Map([...remote, ...local].map((item) => [item.id, item])).values()).map((item) => {
      const other = remote.find((remoteItem) => remoteItem.id === item.id);
      const mine = local.find((localItem) => localItem.id === item.id);
      if (!other || !mine) return item;
      return (mine.updatedAt ?? "") >= (other.updatedAt ?? "") ? mine : other;
    });
    setItems(next);
    lastSyncedRecords.current = JSON.stringify(next);
    familySync.mutate({ records: next, baseVersion: conflictState.version }, { onSuccess: (result) => {
      if (result.conflict) setConflictState({ version: result.version, remoteRecords: result.records as CalendarItem[] });
      else setConflictState(null);
    } });
  };

  const restoreBackup = (backupId: number) => {
    familyRestore.mutate({ backupId }, { onSuccess: async () => { setFamilyMessage("백업을 복원했어요."); await familyQuery.refetch(); } });
  };

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">☾</div>
          <div>
            <span className="brand-kicker">오늘도 차곡차곡</span>
            <div className="brand-name">달달 캘린더 <Sparkles size={14} /></div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className={`sync-button ${familyQuery.data ? "is-synced" : ""}`} type="button" onClick={() => setFamilyOpen(true)}><Cloud size={16} /><span>{familyQuery.data ? "공유 중" : "가족 공유"}</span></button>
          <button className="icon-button" type="button" aria-label="알림"><Bell size={19} /></button>
          <div className="profile-chip">나</div>
        </div>
      </header>

      <main className="page-content">
        {view === "home" && (
          <HomeView
            clock={clock}
            today={today}
            todayISO={todayISO}
            todayTodos={todayTodos}
            todayEvents={todayEvents}
            todayItems={todayItems}
            nextItems={nextItems}
            monthSummary={monthSummary}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={toggleTodo}
            onGoCalendar={() => setViewAndScroll("calendar")}
            formatLongDate={formatLongDate}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            month={month}
            selectedDate={selectedDate}
            selectedItems={selectedItems}
            items={items}
            onMonthChange={changeMonth}
            onSelectDate={setSelectedDate}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={toggleTodo}
            monthSummary={monthSummary}
            onGenerateWallpaper={generateWallpaper}
            isGeneratingWallpaper={isGeneratingWallpaper}
            onOpenLiveWallpaper={openLiveWallpaper}
          />
        )}
        {view === "ledger" && (
          <LedgerView
            month={month}
            monthItems={monthItems}
            summary={monthSummary}
            onMonthChange={changeMonth}
            onEdit={openEdit}
            onCreate={openCreate}
            onManageCategories={() => setCategoryManagerOpen(true)}
            onManageAssets={() => setAssetManagerOpen(true)}
          />
        )}
        {view === "report" && <CashflowReportView month={month} items={displayItems} budget={monthlyBudgets[`${month.getFullYear()}-${pad(month.getMonth() + 1)}`] ?? { expense: 0, loan: 0, categories: {} }} nextBudget={monthlyBudgets[`${addMonths(month, 1).getFullYear()}-${pad(addMonths(month, 1).getMonth() + 1)}`] ?? { expense: 0, loan: 0, categories: {} }} emergencyReserve={emergencyReserve} onEmergencyReserveChange={setEmergencyReserve} onBudgetChange={(budget: { expense: number; loan: number; categories?: Record<string, number> }) => setMonthlyBudgets((current) => ({ ...current, [`${month.getFullYear()}-${pad(month.getMonth() + 1)}`]: budget }))} onNextBudgetChange={(budget: { expense: number; loan: number; categories?: Record<string, number> }) => setMonthlyBudgets((current) => ({ ...current, [`${addMonths(month, 1).getFullYear()}-${pad(addMonths(month, 1).getMonth() + 1)}`]: budget }))} onMonthChange={changeMonth} onEdit={openEdit} />}
      </main>

      <button className="record-button" type="button" onClick={() => openCreate("todo")}>
        <Plus size={20} strokeWidth={2.8} />
        <span>기록하기</span>
      </button>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={view === "home" ? "active" : ""} type="button" onClick={() => setViewAndScroll("home")}><LayoutGrid size={19} /><span>오늘</span></button>
        <button className={view === "calendar" ? "active" : ""} type="button" onClick={() => setViewAndScroll("calendar")}><CalendarDays size={19} /><span>달력</span></button>
        <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => setViewAndScroll("ledger")}><Wallet size={19} /><span>가계부</span></button>
        <button className={view === "report" ? "active" : ""} type="button" onClick={() => setViewAndScroll("report")}><Repeat2 size={19} /><span>현금흐름</span></button>
      </nav>

      {wallpaperMessage && <div className="wallpaper-toast" role="status">{wallpaperMessage}</div>}

      {isFamilyOpen && <FamilyShareSheet authenticated={auth.isAuthenticated} loading={auth.loading} family={familyQuery.data ?? null} familyName={familyName} inviteCode={familyInviteCode} message={familyMessage} conflict={conflictState} onFamilyNameChange={setFamilyName} onInviteCodeChange={setFamilyInviteCode} onCreate={createFamilySpace} onJoin={joinFamilySpace} onCopy={copyFamilyCode} onResolveConflict={resolveConflict} onRestore={restoreBackup} onClose={() => { setFamilyOpen(false); setFamilyMessage(null); }} />}

      {isComposerOpen && (
        <Composer
          draft={draft}
          editing={Boolean(editingId)}
          onChange={setDraft}
          categoryMap={categoryMap}
          monthlyCardSpend={monthlyCardSpend}
          localCurrencyBalances={localCurrencyBalances}
          onClose={() => setComposerOpen(false)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
      {isCategoryManagerOpen && <CategoryManager customCategories={customCategories} onChange={setCustomCategories} onClose={() => setCategoryManagerOpen(false)} />}
      {isAssetManagerOpen && <AssetManager assets={assetBalances} items={displayItems} onChange={setAssetBalances} onClose={() => setAssetManagerOpen(false)} />}
    </div>
  );
}

function HomeView({
  clock,
  today,
  todayISO,
  todayTodos,
  todayEvents,
  todayItems,
  nextItems,
  monthSummary,
  onCreate,
  onEdit,
  onToggle,
  onGoCalendar,
  formatLongDate,
}: {
  clock: Date;
  today: Date;
  todayISO: string;
  todayTodos: CalendarItem[];
  todayEvents: CalendarItem[];
  todayItems: CalendarItem[];
  nextItems: CalendarItem[];
  monthSummary: { income: number; expense: number; loan: number; balance: number };
  onCreate: (type?: ItemType, date?: string) => void;
  onEdit: (item: CalendarItem) => void;
  onToggle: (item: CalendarItem) => void;
  onGoCalendar: () => void;
  formatLongDate: (value: string) => string;
}) {
  const clockText = clock.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateNumber = today.getDate();
  const weekday = today.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  return (
    <div className="view-stack home-view">
      <section className="lock-card">
        <div className="lock-card-topline"><span>MY DAY</span><span className="live-dot"><i /> synced</span></div>
        <div className="lock-date-row">
          <div className="lock-date-number">{pad(dateNumber)}</div>
          <div className="lock-date-copy"><span>{weekday}</span><strong>{formatLongDate(todayISO).replace(/^[^ ]+ /, "")}</strong><small>오늘의 달달한 기록</small></div>
          <div className="lock-clock"><Clock3 size={15} />{clockText}</div>
        </div>
        <div className="lock-divider" />
        <div className="lock-summary-grid">
          <div><span>오늘 할 일</span><strong>{todayTodos.filter((item) => !item.completed).length}<small>개 남음</small></strong></div>
          <div><span>오늘 일정</span><strong>{todayEvents.length}<small>개 있어요</small></strong></div>
          <div><span>이번 달 잔액</span><strong className={monthSummary.balance >= 0 ? "is-positive" : "is-negative"}>{formatCompact(monthSummary.balance)}<small>원</small></strong></div>
        </div>
        <div className="lock-sticker">달달<br />한 칸</div>
      </section>

      <div className="today-intro">
        <div><span className="section-eyebrow">{today.toLocaleDateString("ko-KR", { month: "long" })} {dateNumber}일</span><h2>오늘은 이렇게 보내요</h2></div>
        <button className="text-button" type="button" onClick={onGoCalendar}>달력 보기 <ChevronRight size={16} /></button>
      </div>

      <section className="today-grid">
        <div className="surface-card today-list-card">
          <SectionHeading eyebrow="CHECKLIST" title="오늘 할 일" action={<button className="mini-add" type="button" onClick={() => onCreate("todo", todayISO)}><Plus size={15} /></button>} />
          <div className="list-stack">
            {todayTodos.length ? todayTodos.map((item) => <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />) : <EmptyState label="오늘 할 일을 적어볼까요?" onClick={() => onCreate("todo", todayISO)} />}
          </div>
        </div>
        <div className="surface-card today-list-card event-card">
          <SectionHeading eyebrow="SCHEDULE" title="오늘 일정" action={<button className="mini-add" type="button" onClick={() => onCreate("event", todayISO)}><Plus size={15} /></button>} />
          <div className="list-stack">
            {todayEvents.length ? todayEvents.map((item) => <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />) : <EmptyState label="가벼운 약속을 추가해요" onClick={() => onCreate("event", todayISO)} />}
          </div>
        </div>
      </section>

      <section className="surface-card flow-card">
        <SectionHeading eyebrow="MONEY FLOW" title="이번 달 흐름" action={<button className="icon-link" type="button" onClick={onGoCalendar}>자세히 <ChevronRight size={15} /></button>} />
        <div className="flow-amounts">
          <div className="flow-main"><span>남은 금액</span><strong>{formatWon(monthSummary.balance)}</strong><div className="flow-bar"><i style={{ width: `${Math.min(100, Math.max(10, (monthSummary.expense / Math.max(monthSummary.income, 1)) * 100))}%` }} /></div><small>수입에서 지출·대출을 뺀 금액이에요</small></div>
          <div className="flow-mini"><span className="income-label"><ArrowUpRight size={14} /> 수입</span><strong>{formatCompact(monthSummary.income)}원</strong><span className="expense-label"><ArrowDownRight size={14} /> 지출</span><strong>{formatCompact(monthSummary.expense + monthSummary.loan)}원</strong></div>
        </div>
      </section>

      <section className="next-section">
        <SectionHeading eyebrow="UP NEXT" title="다가오는 기록" action={<button className="text-button" type="button" onClick={onGoCalendar}>전체 보기 <ChevronRight size={16} /></button>} />
        <div className="next-list">
          {nextItems.map((item) => (
            <button className="next-item" key={item.id} type="button" onClick={() => onEdit(item)}>
              <span className="next-date"><strong>{fromISO(item.date).getDate()}</strong><small>{fromISO(item.date).toLocaleDateString("ko-KR", { weekday: "short" })}</small></span>
              <span className="next-line" style={{ backgroundColor: typeMeta[item.type].color }} />
              <span className="next-copy"><strong>{item.title}</strong><small>{typeMeta[item.type].label}{item.time ? ` · ${item.time}` : ""}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
          {!nextItems.length && <div className="soft-empty">새로운 일정이 생기면 여기에 보여요.</div>}
        </div>
      </section>

      <div className="home-tip"><Sparkles size={16} /><span>카드를 눌러 바로 수정할 수 있어요.</span><span className="tip-count">{todayItems.length} records</span></div>
    </div>
  );
}

function CalendarView({
  month,
  selectedDate,
  selectedItems,
  items,
  onMonthChange,
  onSelectDate,
  onCreate,
  onEdit,
  onToggle,
  monthSummary,
  onGenerateWallpaper,
  isGeneratingWallpaper,
  onOpenLiveWallpaper,
}: {
  month: Date;
  selectedDate: string;
  selectedItems: CalendarItem[];
  items: CalendarItem[];
  onMonthChange: (offset: number) => void;
  onSelectDate: (date: string) => void;
  onCreate: (type?: ItemType, date?: string) => void;
  onEdit: (item: CalendarItem) => void;
  onToggle: (item: CalendarItem) => void;
  monthSummary: { income: number; expense: number; loan: number; balance: number };
  onGenerateWallpaper: () => void;
  isGeneratingWallpaper: boolean;
  onOpenLiveWallpaper: () => void;
}) {
  const cells = getCalendarCells(month);
  return (
    <div className="view-stack calendar-view">
      <div className="page-title-row"><div><span className="section-eyebrow">MONTHLY PLANNER</span><h2>한 달을 한눈에</h2></div><div className="page-title-actions"><button className="wallpaper-action" type="button" onClick={onOpenLiveWallpaper}><span aria-hidden="true">▣</span> 잠금화면 적용</button><button className="wallpaper-action" type="button" onClick={onGenerateWallpaper} disabled={isGeneratingWallpaper}><ImageDown size={15} />{isGeneratingWallpaper ? "만드는 중" : "배경 만들기"}</button><button className="round-action" type="button" onClick={() => onCreate("event", selectedDate)}><Plus size={18} /></button></div></div>
      <section className="calendar-panel surface-card">
        <div className="calendar-toolbar"><button className="month-arrow" type="button" onClick={() => onMonthChange(-1)}><ChevronLeft size={18} /></button><div><strong>{monthLabel(month)}</strong><span>기록 {items.filter((item) => item.date.startsWith(`${month.getFullYear()}-${pad(month.getMonth() + 1)}`)).length}개</span></div><button className="month-arrow" type="button" onClick={() => onMonthChange(1)}><ChevronRight size={18} /></button></div>
        <div className="calendar-summary-strip"><span><i className="dot income-dot" /> 수입 {formatCompact(monthSummary.income)}</span><span><i className="dot expense-dot" /> 지출 {formatCompact(monthSummary.expense)}</span><span><i className="dot loan-dot" /> 대출 {formatCompact(monthSummary.loan)}</span></div>
        <div className="weekday-row">{WEEKDAYS.map((day, index) => <span className={index === 0 ? "sun" : index === 6 ? "sat" : ""} key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((date, index) => {
            if (!date) return <div className="calendar-cell empty" key={`empty-${index}`} />;
            const iso = toISO(date);
            const dayItems = items.filter((item) => item.date === iso);
            const isSelected = iso === selectedDate;
            const isToday = iso === toISO(new Date());
            const finances = dayItems.filter((item) => ["income", "expense", "loan"].includes(item.type));
            const chips = dayItems.filter((item) => item.type === "todo" || item.type === "event").slice(0, 2);
            return (
              <button className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`} key={iso} type="button" onClick={() => onSelectDate(iso)}>
                <span className="calendar-day-number">{date.getDate()}</span>
                <span className="calendar-dots">{dayItems.slice(0, 4).map((item) => <i key={item.id} style={{ backgroundColor: typeMeta[item.type].color }} />)}</span>
                <span className="calendar-chips">{chips.map((item) => <span className={`calendar-chip ${item.type === "todo" ? "todo-chip" : "event-chip"}`} style={item.accentColor ? { backgroundColor: `${item.accentColor}22`, color: item.accentColor } : undefined} key={item.id}>{item.title}</span>)}</span>
                {finances.length > 0 && <span className={`calendar-money ${finances.some((item) => item.type === "income") ? "has-income" : ""}`}>{finances.some((item) => item.type === "income") ? "+" : "−"}{formatCompact(finances.reduce((sum, item) => sum + (item.amount ?? 0), 0))}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="selected-day-section">
        <SectionHeading eyebrow="SELECTED DAY" title={formatLongDate(selectedDate)} action={<button className="icon-link" type="button" onClick={() => onCreate("todo", selectedDate)}>+ 추가</button>} />
        <div className="selected-items surface-card">
          {selectedItems.length ? selectedItems.map((item) => <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />) : <EmptyState label="이 날에는 아직 기록이 없어요." onClick={() => onCreate("todo", selectedDate)} />}
        </div>
      </section>
      <div className="calendar-legend"><span><i className="legend-dot todo-dot" />할 일</span><span><i className="legend-dot event-dot" />일정</span><span><i className="legend-dot expense-dot" />지출</span><span><i className="legend-dot income-dot" />수입</span></div>
    </div>
  );
}

function LedgerView({
  month,
  monthItems,
  summary,
  onMonthChange,
  onEdit,
  onCreate,
  onManageCategories,
  onManageAssets,
}: {
  month: Date;
  monthItems: CalendarItem[];
  summary: { income: number; expense: number; loan: number; balance: number };
  onMonthChange: (offset: number) => void;
  onEdit: (item: CalendarItem) => void;
  onCreate: (type?: ItemType, date?: string) => void;
  onManageCategories: () => void;
  onManageAssets: () => void;
}) {
  const financeItems = monthItems.filter((item) => ["income", "expense", "loan", "savings"].includes(item.type)).sort((a, b) => b.date.localeCompare(a.date));
  const grouped = financeItems.reduce<Record<string, CalendarItem[]>>((groups, item) => {
    groups[item.date] = [...(groups[item.date] ?? []), item];
    return groups;
  }, {});
  const categoryTotals = Object.entries(financeItems.reduce<Record<string, number>>((totals, item) => {
    const key = item.category || "미분류";
    totals[key] = (totals[key] ?? 0) + (item.amount ?? 0);
    return totals;
  }, {})).sort(([, a], [, b]) => b - a).slice(0, 4);
  const topCategory = categoryTotals[0];
  const analysisText = topCategory ? `이번 달은 ${topCategory[0]}에 ${formatWon(topCategory[1])}을 기록했어요.` : "기록이 쌓이면 카테고리별 패턴을 분석해 드려요.";
  return (
    <div className="view-stack ledger-view">
      <div className="page-title-row"><div><span className="section-eyebrow">MY LEDGER</span><h2>돈의 흐름도 차곡차곡</h2></div><div className="page-title-actions"><button className="text-button" type="button" onClick={onManageAssets}><WalletCards size={14} /> 자산</button><button className="text-button" type="button" onClick={onManageCategories}><Settings2 size={14} /> 카테고리</button><button className="round-action" type="button" onClick={() => onCreate("expense", toISO(new Date()))}><Plus size={18} /></button></div></div>
      <div className="month-switcher"><button className="month-arrow" type="button" onClick={() => onMonthChange(-1)}><ChevronLeft size={18} /></button><strong>{monthLabel(month)}</strong><button className="month-arrow" type="button" onClick={() => onMonthChange(1)}><ChevronRight size={18} /></button></div>
      <section className="ledger-hero surface-card"><span className="section-eyebrow">MONTHLY BALANCE</span><strong>{formatWon(summary.balance)}</strong><p>이번 달에 남은 금액이에요</p><div className="ledger-hero-bottom"><span><ArrowUpRight size={15} /> 수입 {formatWon(summary.income)}</span><span><ArrowDownRight size={15} /> 지출·대출 {formatWon(summary.expense + summary.loan)}</span></div></section>
      <section className="ledger-stat-grid"><LedgerStat icon={ArrowUpRight} label="수입" amount={summary.income} tone="income" /><LedgerStat icon={ArrowDownRight} label="지출" amount={summary.expense} tone="expense" /><LedgerStat icon={Landmark} label="대출" amount={summary.loan} tone="loan" /></section>
      <section className="ai-analysis-card surface-card"><div className="ai-analysis-head"><span className="ai-spark"><Sparkles size={15} /></span><div><span className="section-eyebrow">AI MONEY INSIGHT</span><strong>카테고리별로 살펴봤어요</strong></div><span className="ai-live">자동 분석</span></div><p>{analysisText}</p><div className="category-analysis-bars">{categoryTotals.length ? categoryTotals.map(([category, amount]) => <div className="category-analysis-row" key={category}><span>{category}</span><div><i style={{ width: `${Math.max(8, (amount / categoryTotals[0][1]) * 100)}%` }} /></div><b>{formatCompact(amount)}원</b></div>) : <span className="analysis-empty">금융 기록을 추가해 보세요.</span>}</div></section>
      <section className="ledger-list-section"><SectionHeading eyebrow="TRANSACTIONS" title="이번 달 기록" action={<button className="text-button" type="button" onClick={() => onCreate("expense", toISO(new Date()))}>빠른 입력 <Plus size={15} /></button>} /><div className="ledger-groups">{Object.keys(grouped).length ? Object.entries(grouped).map(([date, entries]) => <div className="ledger-group" key={date}><div className="ledger-date"><strong>{fromISO(date).getDate()}</strong><span>{fromISO(date).toLocaleDateString("ko-KR", { weekday: "short" })}</span></div><div className="ledger-entries">{entries.map((item) => <button className="ledger-entry" type="button" key={item.id} onClick={() => onEdit(item)}><span className="item-icon" style={{ backgroundColor: typeMeta[item.type].soft, color: typeMeta[item.type].color }}>{(() => { const Icon = typeMeta[item.type].icon; return <Icon size={16} />; })()}</span><span><strong>{item.title}</strong><small>{item.category}{item.assetName ? ` · ${item.assetName}` : ""}{item.type === "expense" && item.paymentMethod ? ` · ${PAYMENT_METHODS.find((method) => method.value === item.paymentMethod)?.label ?? ""}` : ""}</small></span><b className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : "−"}{formatWon(item.amount)}</b><ChevronRight size={15} /></button>)}</div></div>) : <div className="soft-empty">이번 달 금융 기록이 아직 없어요.</div>}</div></section>
    </div>
  );
}

function LedgerStat({ icon: Icon, label, amount, tone }: { icon: LucideIcon; label: string; amount: number; tone: "income" | "expense" | "loan" }) {
  return <div className={`ledger-stat ${tone}`}><span className="stat-icon"><Icon size={16} /></span><span>{label}</span><strong>{formatCompact(amount)}<small>원</small></strong></div>;
}

function CashflowReportView({ month, items, budget, nextBudget, emergencyReserve, onEmergencyReserveChange, onBudgetChange, onNextBudgetChange, onMonthChange, onEdit }: { month: Date; items: CalendarItem[]; budget: { expense: number; loan: number; categories?: Record<string, number> }; nextBudget: { expense: number; loan: number; categories?: Record<string, number> }; emergencyReserve: number; onEmergencyReserveChange: (amount: number) => void; onBudgetChange: (budget: { expense: number; loan: number; categories?: Record<string, number> }) => void; onNextBudgetChange: (budget: { expense: number; loan: number; categories?: Record<string, number> }) => void; onMonthChange: (offset: number) => void; onEdit: (item: CalendarItem) => void }) {
  const monthItems = getMonthItems(items, month).filter((item) => ["income", "expense", "loan", "savings"].includes(item.type)).sort((a, b) => a.date.localeCompare(b.date));
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const fixed = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !isLocalCurrencyTransfer(item) && item.recurrence === "monthly").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const expense = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !isLocalCurrencyTransfer(item) && item.recurrence !== "monthly").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const loan = monthItems.filter((item) => item.type === "loan").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const outgoing = fixed + expense + loan;
  const actualExpense = fixed + expense;
  const categoryStats = Object.entries(monthItems.filter((item) => item.type === "expense" && !isLocalCurrencyTransfer(item)).reduce<Record<string, CalendarItem[]>>((groups, item) => {
    const key = item.category || "미분류";
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {})).map(([category, records]) => ({ category, records, actual: records.reduce((sum, item) => sum + (item.amount ?? 0), 0), budget: budget.categories?.[category] ?? 0 })).sort((a, b) => b.actual - a.actual);
  const roundRecommendation = (amount: number) => Math.ceil(amount * 1.05 / 1000) * 1000;
  const recommendedCategories = Object.fromEntries(categoryStats.map((stat) => [stat.category, roundRecommendation(stat.actual)]));
  const recommendedBudget = { expense: roundRecommendation(actualExpense), loan: roundRecommendation(loan), categories: recommendedCategories };
  const expenseRatio = budget.expense ? actualExpense / budget.expense * 100 : 0;
  const loanRatio = budget.loan ? loan / budget.loan * 100 : 0;
  const ownerNet = (owner: string) => monthItems.filter((item) => (item.owner ?? "나") === owner).reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * (item.amount ?? 0), 0);
  const ownerStats = ["나", "신랑", "공동"].map((owner) => {
    const records = monthItems.filter((item) => (item.owner ?? "나") === owner);
    const ownerIncome = records.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const ownerOutgoing = records.filter((item) => item.type !== "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return { owner, income: ownerIncome, outgoing: ownerOutgoing, balance: ownerIncome - ownerOutgoing };
  });
  const ownerMaxBalance = Math.max(...ownerStats.map((stat) => Math.abs(stat.balance)), 1);
  const totalOwnerFlow = Math.max(ownerStats.reduce((sum, stat) => sum + stat.income + stat.outgoing, 0), 1);
  const nextMonthItems = getMonthItems(items, addMonths(month, 1)).filter((item) => ["expense", "loan"].includes(item.type));
  const nextMonthAllItems = getMonthItems(items, addMonths(month, 1));
  const nextIncome = nextMonthAllItems.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const nextOutgoing = nextMonthItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const householdForecast = [0, 1, 2].map((offset) => {
    const forecastMonth = addMonths(month, offset);
    const records = getMonthItems(items, forecastMonth).filter((item) => ["income", "expense", "loan"].includes(item.type));
    const forecastIncome = records.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const forecastExpense = records.filter((item) => item.type !== "income").reduce((sum, item) => sum + (item.amount ?? 0), 0) + emergencyReserve;
    return { month: forecastMonth, income: forecastIncome, expense: forecastExpense, net: forecastIncome - forecastExpense };
  });
  const forecastCumulative = householdForecast.reduce<number[]>((totals, forecast) => [...totals, (totals[totals.length - 1] ?? 0) + forecast.net], []);
  const forecastMax = Math.max(...householdForecast.map((forecast) => Math.max(forecast.income, forecast.expense)), 1);
  const monthsToYearEnd = Array.from({ length: 12 - month.getMonth() }, (_, index) => addMonths(month, index));
  const yearEndAssetTrend = monthsToYearEnd.map((trendMonth) => {
    const records = getMonthItems(items, trendMonth);
    const savingsContribution = records.filter((item) => item.type === "savings").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const loanPrincipalReduction = records.filter((item) => item.type === "loan").reduce((sum, item) => sum + (item.principalPaid ?? 0), 0);
    return { month: trendMonth, savingsContribution, loanPrincipalReduction, increase: savingsContribution + loanPrincipalReduction };
  });
  const yearEndCumulative = yearEndAssetTrend.reduce<number[]>((totals, trend) => [...totals, (totals[totals.length - 1] ?? 0) + trend.increase], []);
  const yearEndMax = Math.max(...yearEndAssetTrend.map((trend) => trend.increase), 1);
  const chartMax = Math.max(income, outgoing, nextIncome, nextOutgoing, 1);
  const chartHeight = 132;
  const barHeight = (value: number) => Math.max(value ? 5 : 0, Math.round(value / chartMax * chartHeight));
  return <div className="view-stack cashflow-report"><div className="page-title-row"><div><span className="section-eyebrow">CASHFLOW REPORT</span><h2>월별 현금흐름</h2></div><Repeat2 size={24} className="report-mark" /></div><div className="month-switcher"><button className="month-arrow" type="button" onClick={() => onMonthChange(-1)}><ChevronLeft size={18} /></button><strong>{monthLabel(month)}</strong><button className="month-arrow" type="button" onClick={() => onMonthChange(1)}><ChevronRight size={18} /></button></div><section className="cashflow-hero surface-card"><span className="section-eyebrow">ESTIMATED MONTH-END</span><strong>{formatWon(income - outgoing)}</strong><p>수입에서 이번 달 예정된 모든 지출을 뺀 금액</p><div className="cashflow-bar"><i style={{ width: `${Math.min(100, income ? Math.max(0, outgoing / income * 100) : 0)}%` }} /></div><small>지출·고정지출·대출 납부 합계 {formatWon(outgoing)}</small></section><section className="cashflow-stat-grid"><div className="cashflow-stat income"><span>수입</span><strong>{formatWon(income)}</strong></div><div className="cashflow-stat fixed"><span>고정지출</span><strong>{formatWon(fixed)}</strong></div><div className="cashflow-stat expense"><span>일반지출</span><strong>{formatWon(expense)}</strong></div><div className="cashflow-stat loan"><span>대출 납부</span><strong>{formatWon(loan)}</strong></div></section><section className="budget-panel surface-card"><SectionHeading eyebrow="MONTHLY BUDGET" title="예산 대비 실제" /><div className="budget-inputs"><label>지출 예산<input inputMode="numeric" value={budget.expense || ""} onChange={(event) => onBudgetChange({ ...budget, expense: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="예: 1500000" /></label><label>대출 예산<input inputMode="numeric" value={budget.loan || ""} onChange={(event) => onBudgetChange({ ...budget, loan: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="예: 800000" /></label></div><div className="budget-compare"><div className="budget-compare-row"><div><strong>실제 지출</strong><span>{formatWon(actualExpense)} / {formatWon(budget.expense)}</span></div><div className="budget-track"><i className={expenseRatio > 100 ? "over" : ""} style={{ width: `${Math.min(100, expenseRatio)}%` }} /></div><b className={expenseRatio > 100 ? "over-text" : ""}>{budget.expense ? `${Math.round(expenseRatio)}%` : "예산 미설정"}</b></div><div className="budget-compare-row"><div><strong>실제 대출 상환</strong><span>{formatWon(loan)} / {formatWon(budget.loan)}</span></div><div className="budget-track loan-track"><i className={loanRatio > 100 ? "over" : ""} style={{ width: `${Math.min(100, loanRatio)}%` }} /></div><b className={loanRatio > 100 ? "over-text" : ""}>{budget.loan ? `${Math.round(loanRatio)}%` : "예산 미설정"}</b></div></div></section><section className="household-forecast surface-card"><div className="forecast-head"><div><span className="section-eyebrow">HOUSEHOLD SIMULATION</span><strong>가계 전체 순현금흐름 예측</strong></div><PiggyBank size={18} /></div><p className="forecast-note">나와 신랑의 수입을 합산하고, 반복 고정지출과 대출 납부 예정액을 반영한 기본 시뮬레이션이에요.</p><label className="reserve-input">월별 비상 예비비<input inputMode="numeric" value={emergencyReserve || ""} onChange={(event) => onEmergencyReserveChange(Number(event.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="예: 300000" /><small>예상치 못한 병원비·수리비 등을 대비해 매월 예측 지출에 포함합니다.</small></label><div className="forecast-chart">{householdForecast.map((forecast, index) => <div className="forecast-column" key={forecast.month.toISOString()}><div className="forecast-bars"><i className="forecast-income-bar" style={{ height: `${Math.max(forecast.income ? 7 : 0, forecast.income / forecastMax * 100)}%` }} /><i className="forecast-expense-bar" style={{ height: `${Math.max(forecast.expense ? 7 : 0, forecast.expense / forecastMax * 100)}%` }} /></div><strong>{monthShortLabel(forecast.month)}월</strong><b className={forecast.net < 0 ? "negative" : "positive"}>{forecast.net >= 0 ? "+" : "−"}{formatCompact(Math.abs(forecast.net))}</b><small>누적 {formatCompact(forecastCumulative[index])}</small></div>)}</div><div className="forecast-legend"><span><i className="forecast-income-dot" /> 합산 수입</span><span><i className="forecast-expense-dot" /> 지출·대출·예비비</span></div><div className="forecast-total"><span>3개월 후 예상 누적 잔액</span><b>{formatWon(forecastCumulative[forecastCumulative.length - 1] ?? 0)}</b></div></section><section className="net-worth-trend surface-card"><div className="forecast-head"><div><span className="section-eyebrow">YEAR-END NET WORTH</span><strong>연말 순자산 증가 추이</strong></div><Wallet size={18} /></div><p className="forecast-note">적금 납입 원금과 대출 원금 상환분을 합산했어요. 대출 이자는 순자산 증가에서 제외됩니다.</p><div className="net-worth-chart">{yearEndAssetTrend.map((trend, index) => <div className="net-worth-column" key={trend.month.toISOString()}><div className="net-worth-bar-wrap"><i style={{ height: `${Math.max(trend.increase ? 7 : 0, trend.increase / yearEndMax * 100)}%` }} /></div><strong>{monthShortLabel(trend.month)}월</strong><b>{formatCompact(trend.increase)}</b><small>누적 {formatCompact(yearEndCumulative[index])}</small></div>)}</div><div className="net-worth-legend"><span><i className="savings-dot" /> 적금 원금</span><span><i className="principal-dot" /> 대출 원금 감소</span></div><div className="forecast-total"><span>연말까지 예상 순자산 증가</span><b>{formatWon(yearEndCumulative[yearEndCumulative.length - 1] ?? 0)}</b></div></section><section className="next-budget-recommendation surface-card"><div className="recommendation-head"><div><span className="section-eyebrow">SMART FORECAST</span><strong>다음 달 예산 추천</strong></div><Sparkles size={18} /></div><p>이번 달 실제 지출에 5% 여유분을 더해 추천했어요. 현재 다음 달 예산은 {nextBudget.expense || nextBudget.loan ? "설정됨" : "아직 미설정"}이에요.</p><div className="recommendation-grid"><div><span>지출 추천</span><b>{formatWon(recommendedBudget.expense)}</b></div><div><span>대출 추천</span><b>{formatWon(recommendedBudget.loan)}</b></div></div><div className="recommendation-categories">{categoryStats.slice(0, 4).map((stat) => <span key={stat.category}>{stat.category} <b>{formatWon(recommendedCategories[stat.category])}</b></span>)}</div><button className="recommendation-button" type="button" onClick={() => onNextBudgetChange(recommendedBudget)}>추천 금액을 다음 달 예산으로 적용</button></section><section className="category-budget-panel surface-card"><SectionHeading eyebrow="CATEGORY DETAILS" title="카테고리별 지출" /><div className="category-budget-list">{categoryStats.length ? categoryStats.map((stat) => { const ratio = stat.budget ? stat.actual / stat.budget * 100 : 0; return <details className="category-budget-item" key={stat.category}><summary><span className="category-budget-title"><strong>{stat.category}</strong><small>{stat.records.length}건 · 실제 {formatWon(stat.actual)}</small></span><span className="category-budget-summary"><b className={ratio > 100 ? "over-text" : ""}>{stat.budget ? `${Math.round(ratio)}%` : "예산 없음"}</b><ChevronDown size={15} /></span></summary><div className="category-budget-body"><label>이번 달 예산<input inputMode="numeric" value={stat.budget || ""} onChange={(event) => onBudgetChange({ ...budget, categories: { ...(budget.categories ?? {}), [stat.category]: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 } })} placeholder="예산 입력" /></label><div className="category-budget-track"><i className={ratio > 100 ? "over" : ""} style={{ width: `${Math.min(100, ratio)}%` }} /></div><div className="category-detail-list">{stat.records.sort((a, b) => a.date.localeCompare(b.date)).map((item) => <button type="button" className="category-detail-row" key={item.id} onClick={() => onEdit(item)}><span>{fromISO(item.date).getDate()}일</span><strong>{item.title}</strong><b>{formatWon(item.amount)}</b><ChevronRight size={13} /></button>)}</div></div></details>; }) : <div className="soft-empty">이번 달 지출 내역이 없어요.</div>}</div></section><section className="owner-assets"><div className="owner-asset-card wife"><span>여자 모든 자산</span><strong>{formatWon(ownerNet("나"))}</strong><small>나로 등록된 수입·지출·대출</small></div><div className="owner-asset-card husband"><span>남자 모든 자산</span><strong>{formatWon(ownerNet("신랑"))}</strong><small>신랑으로 등록된 수입·지출·대출</small></div><div className="owner-asset-card joint"><span>공동 자산</span><strong>{formatWon(ownerNet("공동"))}</strong><small>공동으로 등록된 기록</small></div></section><section className="owner-stats surface-card"><SectionHeading eyebrow="OWNER BREAKDOWN" title="소유자별 통계" /><div className="owner-stat-list">{ownerStats.map((stat) => <div className="owner-stat-row" key={stat.owner}><div className="owner-stat-head"><strong>{stat.owner}</strong><b>{formatWon(stat.balance)}</b></div><div className="owner-stat-track"><i className={`owner-stat-bar ${stat.owner === "나" ? "wife-bar" : stat.owner === "신랑" ? "husband-bar" : "joint-bar"}`} style={{ width: `${Math.max(stat.balance ? 5 : 0, Math.abs(stat.balance) / ownerMaxBalance * 100)}%` }} /></div><div className="owner-stat-meta"><span>수입 {formatCompact(stat.income)}원</span><span>지출·대출 {formatCompact(stat.outgoing)}원</span><span>현금흐름 {Math.round((stat.income + stat.outgoing) / totalOwnerFlow * 100)}%</span></div></div>)}</div></section><section className="cashflow-chart surface-card"><SectionHeading eyebrow="TWO-MONTH VIEW" title="자산 잔액 추이" /><div className="chart-legend"><span><i className="income-chart-dot" /> 수입</span><span><i className="outgoing-chart-dot" /> 나갈 돈</span></div><div className="cashflow-bars"><div className="cashflow-bar-group"><div className="cashflow-bar-columns"><span className="chart-value income-value">{formatCompact(income)}</span><i className="chart-bar income-bar" style={{ height: barHeight(income) }} /><span className="chart-value outgoing-value">{formatCompact(outgoing)}</span><i className="chart-bar outgoing-bar" style={{ height: barHeight(outgoing) }} /></div><strong>{monthShortLabel(month)}월</strong><small>잔액 {formatCompact(income - outgoing)}</small></div><div className="cashflow-bar-group"><div className="cashflow-bar-columns"><span className="chart-value income-value">{formatCompact(nextIncome)}</span><i className="chart-bar income-bar" style={{ height: barHeight(nextIncome) }} /><span className="chart-value outgoing-value">{formatCompact(nextOutgoing)}</span><i className="chart-bar outgoing-bar" style={{ height: barHeight(nextOutgoing) }} /></div><strong>{monthShortLabel(addMonths(month, 1))}월</strong><small>잔액 {formatCompact(nextIncome - nextOutgoing)}</small></div></div><div className="chart-insight"><PiggyBank size={15} /> 다음 달 예상 잔액은 <b>{formatWon(nextIncome - nextOutgoing)}</b>이에요.</div></section><section className="cashflow-next surface-card"><div><span className="section-eyebrow">NEXT MONTH</span><strong>다음 달 예정 지출</strong></div><b>{formatWon(nextOutgoing)}</b></section><section className="cashflow-list surface-card"><SectionHeading eyebrow="MONTHLY TIMELINE" title="날짜별 현금흐름" />{monthItems.length ? monthItems.map((item) => <button className="cashflow-row" type="button" key={item.id} onClick={() => onEdit(item)}><span className="cashflow-date">{fromISO(item.date).getDate()}일</span><span className="cashflow-row-dot" style={{ backgroundColor: typeMeta[item.type].color }} /><span className="cashflow-row-copy"><strong>{item.title}</strong><small>{item.type === "income" ? "수입" : item.type === "loan" ? `${item.paymentNumber ? `${item.paymentNumber}회차 · ` : ""}대출 납부` : item.type === "savings" ? "매월 적금 납입" : item.recurrence === "monthly" ? "매월 고정지출" : "일반지출"}</small></span><b className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : "−"}{formatWon(item.amount)}</b><ChevronRight size={15} /></button>) : <div className="soft-empty">이번 달 현금흐름 기록이 없어요.</div>}</section></div>;
}

function getAssetCurrentBalance(asset: AssetBalance, items: CalendarItem[]) {
  return items.reduce((balance, item) => {
    const matches = asset.kind === "localCurrency"
      ? item.localCurrencyTarget === asset.name || (item.paymentMethod === "localCurrency" && item.assetName === asset.name)
      : item.assetName === asset.name && item.assetKind === asset.kind;
    if (!matches) return balance;
    if (asset.kind === "localCurrency") {
      if (item.category === "지역화폐 충전") return balance + (item.localCurrencyLoadedAmount ?? item.amount ?? 0);
      if (item.paymentMethod === "localCurrency") return balance - (item.amount ?? 0) + (item.localCurrencyCashbackAmount ?? 0);
      return balance;
    }
    if (item.type === "income") return balance + (item.amount ?? 0);
    if (["expense", "loan", "savings"].includes(item.type)) return balance - (item.amount ?? 0);
    return balance;
  }, asset.initialBalance);
}

function AssetManager({ assets, items, onChange, onClose }: { assets: AssetBalance[]; items: CalendarItem[]; onChange: (value: AssetBalance[]) => void; onClose: () => void }) {
  const [kind, setKind] = useState<AssetBalance["kind"]>("account");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [owner, setOwner] = useState("나");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const resetForm = () => { setEditingAssetId(null); setName(""); setBalance(""); setKind("account"); setOwner("나"); };
  const editAsset = (asset: AssetBalance) => { setEditingAssetId(asset.id); setKind(asset.kind); setName(asset.name); setBalance(String(asset.initialBalance)); setOwner(asset.owner); };
  const addAsset = () => {
    if (!name.trim()) return;
    const next = { id: `asset-${Date.now()}`, kind, name: name.trim(), initialBalance: Number(balance.replace(/[^0-9]/g, "")) || 0, owner };
    onChange(editingAssetId ? assets.map((asset) => asset.id === editingAssetId ? { ...asset, ...next, id: asset.id } : asset) : [...assets, next]);
    resetForm();
  };
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="composer-sheet asset-manager-sheet" role="dialog" aria-modal="true" aria-label="자산 잔액 관리"><div className="sheet-handle" /><div className="sheet-header"><div><span className="section-eyebrow">MY ASSETS</span><h2>현재 가진 돈을 입력해요</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><p className="manager-description">초기 잔액은 이후 입력하는 수입·지출·충전·사용 내역에 자동으로 반영돼요.</p><div className="asset-manager-form"><div className="manager-tabs">{([['account','계좌'],['cash','현금'],['localCurrency','지역화폐']] as const).map(([value, label]) => <button key={value} type="button" className={kind === value ? "active" : ""} onClick={() => setKind(value)}>{label}</button>)}</div><div className="field-row"><label className="field-label">자산 이름<input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "account" ? "예: 신한 주거래" : kind === "cash" ? "예: 지갑" : "예: 경기지역화폐"} /></label><label className="field-label">초기 잔액<input inputMode="numeric" value={balance} onChange={(event) => setBalance(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></label></div><div className="asset-owner-row"><span>소유자</span><div>{["나", "신랑", "공동"].map((value) => <button type="button" className={owner === value ? "selected" : ""} key={value} onClick={() => setOwner(value)}>{value}</button>)}</div></div><button className="save-button asset-add-button" type="button" onClick={addAsset}>{editingAssetId ? "자산 수정 저장" : "자산 추가"} {editingAssetId ? <Check size={16} /> : <Plus size={16} />}</button>{editingAssetId && <button className="asset-cancel-button" type="button" onClick={resetForm}>수정 취소</button>}</div><div className="asset-balance-list">{assets.length ? assets.map((asset) => <div className="asset-balance-row" key={asset.id}><div><strong>{asset.name}</strong><small>{asset.kind === "account" ? "계좌" : asset.kind === "cash" ? "현금" : "지역화폐"} · {asset.owner}</small></div><div className="asset-balance-values"><b>{formatWon(getAssetCurrentBalance(asset, items))}</b><button className="asset-edit-button" type="button" onClick={() => editAsset(asset)} aria-label={`${asset.name} 수정`}><Pencil size={14} /></button><button type="button" onClick={() => { if (window.confirm(`${asset.name} 자산을 삭제할까요?`)) { if (editingAssetId === asset.id) resetForm(); onChange(assets.filter((item) => item.id !== asset.id)); } }} aria-label={`${asset.name} 삭제`}><X size={14} /></button></div></div>) : <div className="soft-empty">등록된 자산이 아직 없어요.</div>}</div><button className="save-button manager-done" type="button" onClick={onClose}>완료 <Check size={17} /></button></section></div>;
}

function CategoryManager({ customCategories, onChange, onClose }: { customCategories: Partial<Record<ItemType, string[]>>; onChange: (value: Partial<Record<ItemType, string[]>>) => void; onClose: () => void }) {
  const [kind, setKind] = useState<"income" | "expense" | "loan" | "savings">("expense");
  const [name, setName] = useState("");
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed || categories[kind].includes(trimmed) || (customCategories[kind] ?? []).includes(trimmed)) return;
    onChange({ ...customCategories, [kind]: [...(customCategories[kind] ?? []), trimmed] });
    setName("");
  };
  const remove = (category: string) => onChange({ ...customCategories, [kind]: (customCategories[kind] ?? []).filter((item) => item !== category) });
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="composer-sheet category-manager-sheet" role="dialog" aria-modal="true" aria-label="카테고리 관리"><div className="sheet-handle" /><div className="sheet-header"><div><span className="section-eyebrow">CATEGORY LAB</span><h2>나만의 카테고리</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><p className="manager-description">추가한 카테고리는 입력 화면과 AI 자동 분류에 바로 반영돼요.</p><div className="manager-tabs">{(["expense", "income", "loan", "savings"] as const).map((type) => <button key={type} className={kind === type ? "active" : ""} type="button" onClick={() => setKind(type)}>{typeMeta[type].label}</button>)}</div><div className="manager-add-row"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="예: 반려동물" /><button type="button" onClick={add}><Plus size={16} /> 추가</button></div><div className="manager-category-list">{categories[kind].map((category) => <span className="manager-category built-in" key={category}>{category}</span>)}{(customCategories[kind] ?? []).map((category) => <span className="manager-category custom" key={category}>{category}<button type="button" onClick={() => remove(category)} aria-label={`${category} 삭제`}><X size={12} /></button></span>)}</div><button className="save-button manager-done" type="button" onClick={onClose}>완료 <Check size={17} /></button></section></div>;
}

function EmptyState({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="empty-state" type="button" onClick={onClick}><span><Plus size={15} /></span>{label}</button>;
}

function FamilyShareSheet({
  authenticated, loading, family, familyName, inviteCode, message, conflict, onFamilyNameChange, onInviteCodeChange, onCreate, onJoin, onCopy, onResolveConflict, onRestore, onClose,
}: {
  authenticated: boolean;
  loading: boolean;
  family: { id: number; name: string; inviteCode: string; records: unknown[]; version: number; backups: Array<{ id: number; version: number; createdAt: string | Date }>; updatedAt: string } | null;
  familyName: string;
  inviteCode: string;
  message: string | null;
  conflict: { version: number; remoteRecords: CalendarItem[] } | null;
  onFamilyNameChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onCopy: () => void;
  onResolveConflict: (mode: "local" | "remote" | "merge") => void;
  onRestore: (backupId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="family-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-topline"><div><span className="section-eyebrow">FAMILY CLOUD</span><h2><Users size={20} /> 가족과 함께 쓰기</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
        {!authenticated ? <div className="family-login-card"><Cloud size={27} /><strong>로그인하면 가족과 동기화할 수 있어요</strong><p>나와 신랑이 같은 가족 공간에 참여하면 일정·할 일·가계부 기록이 자동으로 맞춰집니다.</p><button className="save-button" type="button" onClick={() => startLogin()}>로그인하고 연결하기</button></div> : family ? <div className="family-connected-card"><div className="family-connected-head"><div><span className="connected-dot" /> 실시간 공유 중</div><small>{family.name}</small></div><div className="family-code-box"><span>가족 초대 코드</span><strong>{family.inviteCode}</strong><button type="button" onClick={onCopy}><Copy size={15} /> 복사</button></div><div className="family-sync-note"><Cloud size={15} /> 최근 동기화 {new Date(family.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 약 5초마다 새 기록을 확인해요</div><p>신랑의 앱에서 이 코드를 입력하면 같은 장부를 함께 볼 수 있어요.</p></div> : <><div className="family-intro"><Cloud size={26} /><div><strong>우리 가족 공간 만들기</strong><p>현재 기기의 기록을 가족과 공유할 수 있는 안전한 공간이에요.</p></div></div><label className="field-label">공간 이름<input value={familyName} onChange={(event) => onFamilyNameChange(event.target.value)} /></label><button className="save-button family-main-button" type="button" onClick={onCreate} disabled={loading}>공유 공간 만들고 초대 코드 받기</button><div className="family-divider"><span>또는</span></div><label className="field-label">가족에게 받은 초대 코드<input value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value.toUpperCase())} placeholder="예: AB12CD" maxLength={12} /></label><button className="outline-button family-main-button" type="button" onClick={onJoin} disabled={loading || inviteCode.length < 4}>초대 코드로 참여하기</button></>}
        {conflict && <div className="family-conflict-card"><div className="family-conflict-title"><GitMerge size={16} /> 동시에 수정된 기록이 있어요</div><p>내 기록과 가족 기록을 자동으로 덮어쓰지 않았어요. 원하는 병합 방식을 선택해 주세요.</p><div className="conflict-actions"><button type="button" onClick={() => onResolveConflict("merge")}>자동 병합</button><button type="button" onClick={() => onResolveConflict("local")}>내 기록 우선</button><button type="button" onClick={() => onResolveConflict("remote")}>가족 기록 우선</button></div><small>자동 병합은 같은 항목의 수정 시각이 더 최근인 기록을 선택합니다.</small></div>}
        {family?.backups?.length ? <div className="family-backups"><div className="family-backups-title"><History size={15} /> 최근 자동 백업 <span>저장 전 최대 10개</span></div>{family.backups.slice(0, 3).map((backup) => <div className="family-backup-row" key={backup.id}><span>버전 {backup.version} · {new Date(backup.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><button type="button" onClick={() => onRestore(backup.id)}>복원</button></div>)}</div> : null}
        {message && <div className="family-message" role="status">{message}</div>}
        <small className="family-privacy-note">가족 공간에 참여한 사용자만 기록을 볼 수 있습니다. 인터넷이 연결되지 않으면 기기에 저장된 기록을 계속 사용할 수 있어요.</small>
      </section>
    </div>
  );
}

function Composer({
  draft,
  editing,
  categoryMap,
  onChange,
  onClose,
  onSave,
  onDelete,
  monthlyCardSpend,
  localCurrencyBalances,
}: {
  draft: Draft;
  editing: boolean;
  categoryMap: CategoryMap;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  monthlyCardSpend: Record<string, number>;
  localCurrencyBalances: Record<string, number>;
}) {
  const meta = typeMeta[draft.type];
  const isFinance = ["income", "expense", "loan", "savings"].includes(draft.type);
  const aiSuggestion = isFinance ? aiSuggestCategory(draft.type, `${draft.title} ${draft.note}`, categoryMap) : null;
  const cardAmount = Number(draft.amount || 0);
  const cardFee = Number(draft.cardFeeRate || 0);
  const cardInstallments = Math.max(1, Number(draft.installments || 1));
  const cardTotal = Math.round(cardAmount * (1 + cardFee / 100));
  const cardMonthly = Math.ceil(cardTotal / cardInstallments);
  const officialCardRate = draft.type === "loan" && draft.category === "카드값" && draft.cardMode === "installment" ? getOfficialCardRate(draft.cardCompany, cardInstallments) : undefined;
  const cardBenefit = CARD_BENEFITS[draft.cardCompany] ?? { threshold: 300000, cap: 10000, categories: [] };
  const existingCardSpend = monthlyCardSpend[draft.cardCompany] ?? 0;
  const previewCardSpend = existingCardSpend + (draft.type === "expense" && draft.paymentMethod === "card" && !editing ? cardAmount : 0);
  const cardSpendProgress = Math.min(100, Math.round((previewCardSpend / cardBenefit.threshold) * 100));
  const cardBenefitReady = previewCardSpend >= cardBenefit.threshold;
  const categoryBenefitReady = cardBenefit.categories.includes(draft.category);
  const localCurrencyName = draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐";
  const localCurrencyBalance = localCurrencyBalances[localCurrencyName] ?? 0;
  const update = (patch: Partial<Draft>) => {
    let next = { ...draft, ...patch };
    const cardSettingChanged = patch.cardCompany !== undefined || patch.cardMode !== undefined || patch.installments !== undefined || patch.category === "카드값";
    if (next.type === "loan" && next.category === "카드값" && cardSettingChanged) {
      const officialRate = getOfficialCardRate(next.cardCompany, Math.max(1, Number(next.installments || 1)));
      next = { ...next, cardFeeRate: next.cardMode === "lumpSum" ? "0" : officialRate === undefined ? "" : String(officialRate) };
    }
    const shouldAutoClassify = isFinance && typeof patch.title === "string" && patch.title.trim().length >= 2;
    onChange(shouldAutoClassify ? { ...next, category: aiSuggestCategory(draft.type, `${next.title} ${next.note}`, categoryMap).category } : next);
  };
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="composer-sheet" role="dialog" aria-modal="true" aria-label={editing ? "기록 수정" : "새 기록"}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="section-eyebrow">{editing ? "EDIT RECORD" : "QUICK RECORD"}</span><h2>{editing ? "기록을 다듬어요" : "무엇을 기록할까요?"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
        <div className="type-tabs">{(Object.keys(typeMeta) as ItemType[]).map((type) => { const TypeIcon = typeMeta[type].icon; return <button className={draft.type === type ? "active" : ""} type="button" key={type} onClick={() => update({ type, category: categoryMap[type][0], time: type === "event" ? draft.time || "12:00" : "", assetKind: type === "loan" ? "loan" : type === "savings" ? "savings" : type === "expense" ? "card" : draft.assetKind, accentColor: type === "todo" ? "#6f63b6" : type === "event" ? "#e98272" : "" })}><TypeIcon size={15} />{typeMeta[type].label}</button>; })}</div>
        <div className="composer-form">
          <label className="field-label">{isFinance ? "무엇에 대한 기록인가요?" : draft.type === "event" ? "일정 이름" : "할 일"}<input autoFocus value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder={draft.type === "todo" ? "예: 장보기" : draft.type === "event" ? "예: 저녁 약속" : "예: 점심 식사"} /></label>
          <div className="field-row"><label className="field-label">날짜<input type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} /></label>{draft.type === "event" && <label className="field-label">시간<input type="time" value={draft.time} onChange={(event) => update({ time: event.target.value })} /></label>}{isFinance && <label className="field-label">금액<input inputMode="numeric" value={draft.amount} onChange={(event) => update({ amount: event.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></label>}</div>
          <div className="field-label">분류<div className="category-pills">{categoryMap[draft.type].map((category) => <button className={draft.category === category ? "selected" : ""} type="button" key={category} onClick={() => update({ category })}>{category}</button>)}</div>{aiSuggestion && <div className="ai-suggestion"><Sparkles size={13} /><span><strong>AI 자동 분류</strong> {aiSuggestion.reason}</span><b>{aiSuggestion.confidence}%</b></div>}</div>
          {(["income", "expense", "loan", "savings"] as ItemType[]).includes(draft.type) && <div className="asset-owner-row"><span>자산 소유자</span><div>{["나", "신랑", "공동"].map((owner) => <button className={draft.owner === owner ? "selected" : ""} type="button" key={owner} onClick={() => update({ owner })}>{owner}</button>)}</div></div>}
          {isFinance && <div className="detail-block asset-block"><div className="detail-block-title"><WalletCards size={15} /> 어떤 자산으로 기록할까요?</div><div className="field-row"><label className="field-label">자산 종류<select value={draft.assetKind} onChange={(event) => update({ assetKind: event.target.value as Draft["assetKind"] })}>{ASSET_KINDS.map((asset) => <option value={asset.value} key={asset.value}>{asset.label}</option>)}</select></label><label className="field-label">자산 이름<span className="optional">선택</span><input value={draft.assetName} onChange={(event) => update({ assetName: event.target.value })} placeholder={draft.assetKind === "card" ? "예: 삼성카드" : draft.assetKind === "account" ? "예: 신한 주거래" : "예: 생활비"} /></label></div>{draft.type === "expense" && <label className="field-label">결제수단<select value={draft.paymentMethod} onChange={(event) => update({ paymentMethod: event.target.value as Draft["paymentMethod"] })}>{PAYMENT_METHODS.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}</select></label>}{draft.type === "expense" && draft.category === "지역화폐 충전" && <div className="detail-block local-currency-block"><div className="detail-block-title">지역화폐 충전 설정</div><div className="field-row"><label className="field-label">출금 계좌<input value={draft.localCurrencySource} onChange={(event) => update({ localCurrencySource: event.target.value, assetKind: "account", paymentMethod: "account" })} placeholder="예: 신한 주거래" /></label><label className="field-label">지역화폐 자산<input value={draft.localCurrencyTarget} onChange={(event) => update({ localCurrencyTarget: event.target.value })} placeholder="예: 경기지역화폐" /></label></div><label className="field-label">충전 할인율(%)<input inputMode="decimal" value={draft.localCurrencyDiscountRate} onChange={(event) => update({ localCurrencyDiscountRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 10" /></label>{draft.amount && <div className="local-currency-estimate">계좌에서 {formatWon(Number(draft.amount))} 출금 · {formatWon(Math.round(Number(draft.amount) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)))} 충전 · 할인 {formatWon(Math.max(0, Math.round(Number(draft.amount) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)) - Number(draft.amount)))}</div>}</div>}{draft.type === "expense" && draft.paymentMethod === "localCurrency" && <div className="detail-block local-currency-use-block"><div className="detail-block-title">지역화폐로 결제</div><label className="field-label">사용할 지역화폐 자산<input value={draft.localCurrencyTarget} onChange={(event) => update({ localCurrencyTarget: event.target.value, assetKind: "localCurrency", assetName: event.target.value })} placeholder="예: 경기지역화폐" /></label><label className="field-label">캐시백률(%)<input inputMode="decimal" value={draft.localCurrencyCashbackRate} onChange={(event) => update({ localCurrencyCashbackRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 5" /></label><div className="local-currency-cashback-preview">이번 결제 예상 캐시백 {formatWon(Math.round(Number(draft.amount || 0) * Number(draft.localCurrencyCashbackRate || 0) / 100))} · 결제 후 잔액에 자동 재적립</div><div className={`local-currency-balance ${localCurrencyBalance < Number(draft.amount || 0) ? "insufficient" : ""}`}><span>{localCurrencyName} 현재 잔액</span><strong>{formatWon(localCurrencyBalance)}</strong>{draft.amount && localCurrencyBalance < Number(draft.amount) && <small>잔액이 {formatWon(Number(draft.amount) - localCurrencyBalance)} 부족해요.</small>}</div></div>}{draft.type === "expense" && draft.paymentMethod === "card" && <><label className="field-label">결제 카드<select value={draft.cardCompany} onChange={(event) => update({ cardCompany: event.target.value, assetKind: "card", assetName: event.target.value })}>{CARD_COMPANIES.map((company) => <option key={company}>{company}</option>)}</select></label><div className="card-benefit-panel"><div className="card-benefit-head"><span><CreditCard size={14} /> {draft.cardCompany} 이번 달 실적</span><strong className={cardBenefitReady ? "ready" : "pending"}>{cardBenefitReady ? "혜택 조건 충족" : `${formatWon(Math.max(0, cardBenefit.threshold - previewCardSpend))} 부족`}</strong></div><div className="card-benefit-progress"><i style={{ width: `${cardSpendProgress}%` }} /></div><div className="card-benefit-meta"><span>{formatWon(previewCardSpend)} / {formatWon(cardBenefit.threshold)}</span><span>예상 할인 한도 {formatWon(cardBenefit.cap)}</span></div><small>{categoryBenefitReady ? "현재 카테고리는 할인 대상에 포함된 것으로 설정되어 있어요." : "현재 카테고리는 등록된 참고 혜택 대상과 다를 수 있어요."} 카드 상품별 실제 조건은 카드사 약관을 확인해 주세요.</small></div></>}</div>}
          {(["todo", "event"] as ItemType[]).includes(draft.type) && <div className="asset-owner-row"><span>{draft.type === "todo" ? "할 일" : "일정"} 색상</span><div className="color-choice">{["#6f63b6", "#e98272", "#4c9d83", "#5ca9d6", "#e2b34f", "#d26aa2"].map((color) => <button className={draft.accentColor === color ? "selected" : ""} style={{ backgroundColor: color }} type="button" key={color} onClick={() => update({ accentColor: color })} aria-label={`${color} 색상`} />)}</div></div>}
          {(["expense", "loan"] as ItemType[]).includes(draft.type) && <div className="detail-block recurring-block"><div className="detail-block-title">고정지출·가족 부담 설정</div><label className="field-label">반복 주기<select value={draft.recurrence} onChange={(event) => update({ recurrence: event.target.value as Draft["recurrence"] })}><option value="none">한 번만</option><option value="monthly">매월 반복</option></select></label>{draft.recurrence === "monthly" && <label className="field-label">반복 종료일<input type="date" value={draft.repeatUntil} min={draft.date} onChange={(event) => update({ repeatUntil: event.target.value })} /></label>}<span className="field-hint">카드값·관리비·통신비처럼 매달 나가는 금액을 달력에 자동 표시해요.</span></div>}
          {draft.type === "loan" && draft.category === "대출" && <div className="detail-block"><div className="detail-block-title">대출 상세 설정</div><div className="field-row"><label className="field-label">대출 원금<input inputMode="numeric" value={draft.loanPrincipal} onChange={(event) => update({ loanPrincipal: event.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></label><label className="field-label">연 이자율(%)<input inputMode="decimal" value={draft.interestRate} onChange={(event) => update({ interestRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 4.5" /></label></div><div className="field-row"><label className="field-label">거치기간(개월)<input inputMode="numeric" value={draft.gracePeriod} onChange={(event) => update({ gracePeriod: event.target.value.replace(/[^0-9]/g, "") })} /></label><label className="field-label">첫 상환일<input type="date" value={draft.repaymentDate} onChange={(event) => update({ repaymentDate: event.target.value })} /></label></div><div className="field-row"><label className="field-label">상환방식<select value={draft.repaymentMethod} onChange={(event) => update({ repaymentMethod: event.target.value as Draft["repaymentMethod"] })}><option value="equalPayment">원리금균등</option><option value="equalPrincipal">원금균등</option></select></label><label className="field-label">상환기간(개월)<input inputMode="numeric" value={draft.termMonths} onChange={(event) => update({ termMonths: event.target.value.replace(/[^0-9]/g, "") })} /></label></div>{draft.loanPrincipal && draft.interestRate && draft.termMonths && <div className="schedule-preview"><strong>{draft.repaymentMethod === "equalPayment" ? "원리금균등" : "원금균등"} · 총 {Number(draft.termMonths) + Number(draft.gracePeriod || 0)}회</strong><span>거치기간은 이자만 납부하고, 이후 월별 상환일을 달력에 자동 표시해요.</span></div>}</div>}
          {draft.type === "loan" && draft.category === "카드값" && <div className="detail-block"><div className="detail-block-title">카드 결제 상세</div><div className="field-row"><label className="field-label">카드사<select value={draft.cardCompany} onChange={(event) => update({ cardCompany: event.target.value })}>{CARD_COMPANIES.map((company) => <option key={company}>{company}</option>)}</select></label><label className="field-label">결제 방식<select value={draft.cardMode} onChange={(event) => update({ cardMode: event.target.value as Draft["cardMode"] })}><option value="lumpSum">일시불</option><option value="installment">할부</option></select></label></div><div className="field-row"><label className="field-label">수수료율(%)<input inputMode="decimal" value={draft.cardFeeRate} onChange={(event) => update({ cardFeeRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="카드사 안내 수수료" /></label>{draft.cardMode === "installment" && <label className="field-label">할부 개월<input inputMode="numeric" value={draft.installments} onChange={(event) => update({ installments: event.target.value.replace(/[^0-9]/g, "") })} /></label>}</div>{draft.cardMode === "installment" && <div className={`rate-source ${officialCardRate !== undefined ? "verified" : "manual"}`}>{officialCardRate !== undefined ? `공식 기준 자동 적용 · 연 ${officialCardRate}%` : getCardRateBasis(draft.cardCompany, cardInstallments)}</div>}<div className="detail-estimate">예상 총 결제액 {formatWon(cardTotal)} · {draft.cardMode === "installment" ? `월 ${formatWon(cardMonthly)}` : "일시불 결제"}</div></div>}
          {draft.type === "savings" && <div className="detail-block savings-block"><div className="detail-block-title">적금 상세 설정</div><div className="field-row"><label className="field-label">연 이자율(%)<input inputMode="decimal" value={draft.savingsInterestRate} onChange={(event) => update({ savingsInterestRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 3.5" /></label><label className="field-label">납입 기간(개월)<input inputMode="numeric" value={draft.savingsTermMonths} onChange={(event) => update({ savingsTermMonths: event.target.value.replace(/[^0-9]/g, "") })} placeholder="12" /></label></div><label className="field-label">만기일<input type="date" value={draft.savingsMaturityDate} onChange={(event) => update({ savingsMaturityDate: event.target.value })} /></label>{draft.amount && draft.savingsTermMonths && <div className="detail-estimate">예상 원금 {formatWon(Number(draft.amount) * Number(draft.savingsTermMonths))} · 월 {formatWon(Number(draft.amount))} 납입</div>}</div>}
          <label className="field-label">메모 <span className="optional">선택</span><textarea value={draft.note} onChange={(event) => update({ note: event.target.value })} placeholder="잊지 않을 한마디를 남겨보세요" rows={2} /></label>
        </div>
        <div className="sheet-actions"><button className="save-button" type="button" style={{ backgroundColor: meta.color }} onClick={onSave}>{editing ? "수정 저장" : "기록 저장"}<Check size={17} /></button>{editing && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}</div>
      </section>
    </div>
  );
}
