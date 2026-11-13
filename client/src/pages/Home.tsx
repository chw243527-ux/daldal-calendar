import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Cloud,
  Copy,
  Share2,
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
  Download,
  Upload,
  Wallet,
  WalletCards,
  Users,
  X,
} from "lucide-react";
import { syncNativeWidget } from "@/lib/widget";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { createMonthlyWallpaper, downloadWallpaper, openNativeLiveWallpaperSettings, setNativeLockScreenWallpaper } from "@/lib/wallpaper";

type ItemType = "todo" | "event" | "income" | "expense" | "transfer" | "loan" | "savings";
type View = "home" | "calendar" | "ledger" | "report" | "settings";

type CalendarItem = {
  id: string;
  type: ItemType;
  title: string;
  date: string;
  endDate?: string;
  time?: string;
  amount?: number;
  category?: string;
  note?: string;
  completed?: boolean;
  completedDates?: string[];
  expectedIncome?: boolean;
  expectedExpense?: boolean;
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
  recurrence?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatUntil?: string;
  calendarKind?: "solar" | "lunar";
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
  owner?: string;
  accentColor?: string;
  cardCompany?: string;
  cardMode?: "lumpSum" | "installment";
  installments?: number;
  cardFeeRate?: number;
  savingsMaturityDate?: string;
  savingsInterestRate?: number;
  savingsTermMonths?: number;
  assetKind?: "account" | "card" | "cash" | "savings" | "loan" | "localCurrency" | "stock" | "crypto" | "other";
  assetName?: string;
  paymentMethod?: "card" | "cash" | "account" | "localCurrency" | "other";
  localCurrencyDiscountRate?: number;
  localCurrencySource?: string;
  localCurrencyTarget?: string;
  localCurrencyLoadedAmount?: number;
  localCurrencyCashbackRate?: number;
  localCurrencyCashbackAmount?: number;
  transferFrom?: string;
  transferTo?: string;
  updatedAt?: string;
  dueDate?: string;
  autopay?: boolean;
  autopayAccount?: string;
  paymentStatus?: "scheduled" | "paid" | "missed";
};

type AssetBalance = {
  id: string;
  kind: "account" | "cash" | "localCurrency" | "stock" | "crypto";
  name: string;
  initialBalance: number;
  owner: string;
  quantity?: number;
  averagePurchasePrice?: number;
  currentPrice?: number;
  ticker?: string;
  priceCurrency?: string;
  priceUpdatedAt?: string;
  nativePrice?: number;
  nativeCurrency?: string;
  fxRate?: number;
};

type Draft = {
  type: ItemType;
  title: string;
  date: string;
  endDate: string;
  time: string;
  amount: string;
  category: string;
  note: string;
  expectedIncome: boolean;
  expectedExpense: boolean;
  loanPrincipal: string;
  interestRate: string;
  gracePeriod: string;
  repaymentDate: string;
  repaymentMethod: "equalPayment" | "equalPrincipal";
  termMonths: string;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatUntil: string;
  calendarKind: "solar" | "lunar";
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
  owner: string;
  accentColor: string;
  cardCompany: string;
  cardMode: "lumpSum" | "installment";
  installments: string;
  cardFeeRate: string;
  savingsMaturityDate: string;
  savingsInterestRate: string;
  savingsTermMonths: string;
  assetKind: "account" | "card" | "cash" | "savings" | "loan" | "localCurrency" | "stock" | "crypto" | "other";
  assetName: string;
  paymentMethod: "card" | "cash" | "account" | "localCurrency" | "other";
  localCurrencyDiscountRate: string;
  localCurrencySource: string;
  localCurrencyTarget: string;
  localCurrencyCashbackRate: string;
  transferFrom: string;
  transferTo: string;
  dueDate: string;
  autopay: boolean;
  autopayAccount: string;
  paymentStatus: "scheduled" | "paid" | "missed";
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "daldal-calendar-items";
const CATEGORY_STORAGE_KEY = "daldal-calendar-custom-categories";
const BUDGET_STORAGE_KEY = "daldal-calendar-monthly-budgets";
const RESERVE_STORAGE_KEY = "daldal-calendar-emergency-reserve";
const ASSET_BALANCE_STORAGE_KEY = "daldal-calendar-asset-balances";
const LOCKSCREEN_STORAGE_KEY = "daldal-calendar-lockscreen-config";
const scopedStorageKey = (key: string, openId?: string) => openId ? `${key}-${encodeURIComponent(openId)}` : key;
type LockScreenTheme = "ivory" | "blush" | "sage" | "night";
type LockScreenConfig = { showCalendar: boolean; showSchedule: boolean; showTodo: boolean; showMonthlyFunds: boolean; backgroundTheme: LockScreenTheme; fontScale: "small" | "medium" | "large"; customBackgroundColor: string; customAccentColor: string };
const DEFAULT_LOCKSCREEN_CONFIG: LockScreenConfig = { showCalendar: true, showSchedule: true, showTodo: true, showMonthlyFunds: true, backgroundTheme: "ivory", fontScale: "medium", customBackgroundColor: "", customAccentColor: "" };
const LOCKSCREEN_PRESETS: Array<{ id: string; label: string; description: string; theme: LockScreenTheme; background: string; accent: string; fontScale: LockScreenConfig["fontScale"] }> = [
  { id: "cozy", label: "포근한 기본", description: "아이보리 · 코랄", theme: "ivory", background: "#F9F6F2", accent: "#D87568", fontScale: "medium" },
  { id: "sage-lavender", label: "세이지 라벤더", description: "차분하고 감성적", theme: "sage", background: "#EDF5F0", accent: "#8F82D8", fontScale: "medium" },
  { id: "peach-berry", label: "복숭아 베리", description: "귀엽고 따뜻하게", theme: "blush", background: "#FFF0ED", accent: "#D95F68", fontScale: "large" },
  { id: "midnight-gold", label: "미드나이트 골드", description: "어두운 배경 · 골드", theme: "night", background: "#25232A", accent: "#E8B86A", fontScale: "medium" },
  { id: "plum-moon", label: "플럼 문", description: "어두운 보라 · 라벤더", theme: "night", background: "#302A3D", accent: "#C99BE8", fontScale: "medium" },
  { id: "forest-mint", label: "포레스트 민트", description: "어두운 초록 · 민트", theme: "night", background: "#1F3430", accent: "#7AD1B0", fontScale: "large" },
];
type CategoryMap = Record<ItemType, string[]>;

const typeMeta: Record<ItemType, { label: string; color: string; soft: string; icon: LucideIcon }> = {
  todo: { label: "할 일", color: "#716a65", soft: "#f1eeeb", icon: ClipboardCheck },
  event: { label: "일정", color: "#c96f64", soft: "#fff0ed", icon: CalendarDays },
  income: { label: "수입", color: "#668a7b", soft: "#edf5f0", icon: ArrowUpRight },
  expense: { label: "지출", color: "#c96f64", soft: "#fff0ed", icon: ArrowDownRight },
  loan: { label: "대출", color: "#89766a", soft: "#f3eeea", icon: Landmark },
  savings: { label: "적금", color: "#668a7b", soft: "#edf5f0", icon: Wallet },
  transfer: { label: "이체", color: "#716a65", soft: "#f1eeeb", icon: WalletCards },
};

const categories: Record<ItemType, string[]> = {
  todo: ["개인", "업무", "집안일", "쇼핑"],
  event: ["약속", "업무", "건강", "가족"],
  income: ["급여", "용돈", "부수입", "환급"],
  expense: ["식비", "교통", "쇼핑", "구독", "생활", "지역화폐 충전"],
  loan: ["대출", "카드값", "할부", "저축"],
  savings: ["적금", "목돈", "여행", "주택"],
  transfer: ["계좌 이체", "현금 이체", "자산 이동"],
};
const CARD_COMPANIES = ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "우리카드", "하나카드", "NH농협카드"];
const ASSET_KINDS = [{ value: "account", label: "계좌" }, { value: "card", label: "카드" }, { value: "cash", label: "현금" }, { value: "savings", label: "적금" }, { value: "loan", label: "대출" }, { value: "localCurrency", label: "지역화폐" }, { value: "stock", label: "주식" }, { value: "crypto", label: "코인" }, { value: "other", label: "기타" }] as const;
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
function differenceInDays(later: Date, earlier: Date) {
  return Math.round((Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) - Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) / 86400000);
}

function addMonths(date: Date, amount: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}
function addYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, date.getMonth(), Math.min(date.getDate(), new Date(date.getFullYear() + amount, date.getMonth() + 1, 0).getDate()), 12);
}
const lunarFormatter = new Intl.DateTimeFormat("ko-KR-u-ca-chinese", { month: "numeric", day: "numeric" });
function getLunarMonthDay(date: Date) {
  const parts = lunarFormatter.formatToParts(date);
  const monthValue = parts.find((part) => part.type === "month")?.value ?? "0";
  const lunarLeapMonth = monthValue.startsWith("윤");
  const month = Number(monthValue.replace(/^윤/, ""));
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);
  return { month, day, lunarLeapMonth };
}
function findLunarDate(year: number, month: number, day: number, lunarLeapMonth = false) {
  let regularFallback: Date | undefined;
  for (let index = 0; index < 366; index += 1) {
    const candidate = new Date(year, 0, 1 + index, 12);
    if (candidate.getFullYear() !== year) break;
    const lunar = getLunarMonthDay(candidate);
    if (lunar.month === month && lunar.day === day) {
      if (lunar.lunarLeapMonth === lunarLeapMonth) return candidate;
      if (!lunar.lunarLeapMonth) regularFallback = candidate;
    }
  }
  // 윤달이 없는 해에는 같은 월·일의 평달을 대체 날짜로 사용합니다.
  return regularFallback;
}
function addMonthsClamped(date: Date, amount: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

function getRecurringDates(item: CalendarItem) {
  const start = fromISO(item.date);
  // 이전 버전에서 반복 주기를 recurrence 대신 다른 이름으로 저장한
  // 일정도 읽어 매년 반복이 끊기지 않도록 호환합니다.
  const legacyItem = item as CalendarItem & { repeatCycle?: string; repeatType?: string; recurring?: string };
  const recurrence = item.recurrence ?? legacyItem.repeatCycle ?? legacyItem.repeatType ?? legacyItem.recurring ?? "none";
  if (recurrence === "none") return [start];
  // 종료일이 비어 있으면 없음으로 간주해 장기간 달력을 이동해도 반복 일정을 표시합니다.
  const fallbackEnd = recurrence === "daily" ? addDays(start, 1000) : recurrence === "weekly" ? addDays(start, 3640) : recurrence === "monthly" ? addMonths(start, 360) : addYears(start, 50);
  const storedEnd = item.repeatUntil ? fromISO(item.repeatUntil) : undefined;
  // 예전 버전에서 종료 없음이 시작일 또는 시작 연도 안의 값으로 저장된
  // 매년 반복 일정은 이후 연도까지 계속 표시되도록 복구합니다.
  const legacyYearlyNoEnd = recurrence === "yearly" && storedEnd && storedEnd.getFullYear() === start.getFullYear();
  const end = storedEnd && storedEnd > start && !legacyYearlyNoEnd ? storedEnd : fallbackEnd;
  if (end < start) return [start];
  const dates: Date[] = [];
  const limit = 1000;
  for (let index = 0; index < limit; index += 1) {
    let date: Date;
    if (recurrence === "daily") date = addDays(start, index);
    else if (recurrence === "weekly") date = addDays(start, index * 7);
    else if (recurrence === "yearly" && item.calendarKind === "lunar" && item.lunarMonth && item.lunarDay) date = findLunarDate(start.getFullYear() + index, item.lunarMonth, item.lunarDay, item.lunarLeapMonth) ?? addYears(start, index);
    else if (recurrence === "monthly") date = addMonthsClamped(start, index);
    else if (recurrence === "yearly") date = addYears(start, index);
    else date = addYears(start, index);
    if (date > end) break;
    if (date >= start) dates.push(date);
  }
  return dates.length ? dates : [start];
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
    // 은행 명세서의 첫 실제 출금액이 입력되어 있으면 계산값보다 우선합니다.
    // 일수 계산·기준일·원 단위 절사 때문에 앱의 단순 월이율 계산과 실제 금액이 다를 수 있습니다.
    const amount = index === 1 && item.amount ? item.amount : interest + principalPaid;
    const recordedInterest = index === 1 && item.amount ? Math.max(0, amount - principalPaid) : interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ ...item, id: `${item.id}-schedule-${index}`, sourceLoanId: item.id, title: isGrace ? `${item.title} · 거치 ${index}회차` : `${item.title} · ${index - graceMonths}회차`, date: toISO(addMonthsClamped(fromISO(item.repaymentDate), index - 1)), amount, note: `${isGrace ? "거치기간 이자" : item.repaymentMethod === "equalPrincipal" ? "원금균등 상환" : "원리금균등 상환"} · 원금 ${formatWon(principalPaid)} · 이자 ${formatWon(recordedInterest)} · 잔액 ${formatWon(balance)}`, paymentNumber: index, principalPaid, interestPaid: recordedInterest, remainingBalance: balance });
  }
  return schedule;
}

function sortCalendarChips(items: CalendarItem[]) {
  // 같은 날짜에서는 일정(event)을 먼저, 할 일(todo)을 항상 그 아래에 표시합니다.
  // 새 항목 ID의 생성 시각을 사용해 먼저 등록한 항목이 위에 유지되도록 합니다.
  const registeredAt = (item: CalendarItem, index: number) => {
    const match = item.id.match(/^item-(\d+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER + index;
  };
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    const typeOrder = Number(a.item.type === "todo") - Number(b.item.type === "todo");
    if (typeOrder !== 0) return typeOrder;
    const rangeOrder = Number(!(a.item.type === "event" && a.item.endDate && a.item.endDate > a.item.date)) - Number(!(b.item.type === "event" && b.item.endDate && b.item.endDate > b.item.date));
    if (rangeOrder !== 0) return rangeOrder;
    return registeredAt(a.item, a.index) - registeredAt(b.item, b.index);
  }).map(({ item }) => item);
}

function getDisplayItems(items: CalendarItem[], rangeStart?: string, rangeEnd?: string) {
  return items.flatMap((item) => {
    if (item.type === "loan" && item.termMonths && item.loanPrincipal) {
      const schedule = calculateLoanSchedule(item);
      return schedule.length ? schedule : [item];
    }
    // 결제일·납부일을 기준으로 반복해야 하는 자동이체는 dueDate에서 확장합니다.
    const scheduleBase = ["expense", "loan"].includes(item.type) && item.dueDate ? { ...item, date: item.dueDate } : item;
    const legacySchedule = scheduleBase as CalendarItem & { repeatCycle?: string; repeatType?: string; recurring?: string };
    const recurrence = scheduleBase.recurrence ?? legacySchedule.repeatCycle ?? legacySchedule.repeatType ?? legacySchedule.recurring ?? "none";
    if (recurrence !== "none") {
      // 현재 보고 있는 달까지만 계산합니다. 종료일이 없는 반복은 미리
      // 50년치로 잘라 저장하지 않고, 사용자가 어느 연도로 이동하든
      // 그 달의 날짜를 다시 계산하므로 삭제 전까지 계속 표시됩니다.
      const legacyYearlyEnd = recurrence === "yearly" && scheduleBase.repeatUntil && scheduleBase.repeatUntil.slice(0, 4) === scheduleBase.date.slice(0, 4);
      const boundedEnd = rangeEnd && (!scheduleBase.repeatUntil || scheduleBase.repeatUntil > rangeEnd || legacyYearlyEnd) ? rangeEnd : scheduleBase.repeatUntil;
      const recurringItem = boundedEnd ? { ...scheduleBase, repeatUntil: boundedEnd } : scheduleBase;
      return getRecurringDates(recurringItem)
        .filter((date) => !rangeStart || toISO(date) >= rangeStart)
        .filter((date) => !rangeEnd || toISO(date) <= rangeEnd)
        .map((date, index) => {
          const occurrenceDate = toISO(date);
          const originalDuration = scheduleBase.type === "event" && scheduleBase.endDate ? differenceInDays(fromISO(scheduleBase.endDate), fromISO(scheduleBase.date)) : 0;
          return {
            ...scheduleBase,
            id: `${item.id}-repeat-${occurrenceDate}`,
            sourceLoanId: item.id,
            date: occurrenceDate,
            endDate: scheduleBase.type === "event" && scheduleBase.endDate ? toISO(addDays(date, Math.max(0, originalDuration))) : scheduleBase.endDate,
            completed: item.completedDates ? item.completedDates.includes(occurrenceDate) : item.completed,
            title: index && ["expense", "loan", "savings"].includes(item.type) ? `${item.title} · ${index + 1}회차` : item.title,
          };
        });
    }
    if (["expense", "loan"].includes(item.type) && item.dueDate && item.dueDate !== item.date) {
      return [{ ...item, id: `${item.id}-due`, date: item.dueDate, title: `${item.title} · ${item.autopay ? "자동이체" : "결제 예정"}` }];
    }
    return !rangeStart || !rangeEnd || (item.date <= rangeEnd && (!item.endDate || item.endDate >= rangeStart)) ? [item] : [];
  });
}

function isDateInRange(item: CalendarItem, date: string) {
  if (item.type !== "event" || !item.endDate) return item.date === date;
  return item.date <= date && date <= item.endDate;
}

function getRangePosition(item: CalendarItem, date: string) {
  if (item.type !== "event" || !item.endDate || item.endDate <= item.date) return "single";
  if (date === item.date) return "start";
  if (date === item.endDate) return "end";
  return "middle";
}

function formatWon(value = 0) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
function formatLunarDate(date: Date) {
  const lunar = getLunarMonthDay(date);
  return `${lunar.lunarLeapMonth ? "윤" : ""}${lunar.month}.${lunar.day}`;
}
function getKoreanHolidayName(date: Date) {
  const year = date.getFullYear();
  const holidays = new Map<string, string>();
  const add = (value: Date | undefined, name: string) => { if (value && value.getFullYear() === year) holidays.set(toISO(value), name); };
  const fixed: Array<[number, number, string]> = [[1, 1, "신정"], [3, 1, "삼일절"], [5, 5, "어린이날"], [6, 6, "현충일"], [8, 15, "광복절"], [10, 3, "개천절"], [10, 9, "한글날"], [12, 25, "성탄절"]];
  fixed.forEach(([month, day, name]) => add(new Date(year, month - 1, day, 12), name));
  const addLunarHoliday = (month: number, day: number, name: string, span = false) => {
    const lunarDate = findLunarDate(year, month, day, false);
    if (!lunarDate) return;
    if (span) [-1, 0, 1].forEach((offset) => add(addDays(lunarDate, offset), name)); else add(lunarDate, name);
  };
  addLunarHoliday(1, 1, "설날", true);
  addLunarHoliday(4, 8, "부처님오신날");
  addLunarHoliday(8, 15, "추석", true);
  [...holidays.entries()].forEach(([iso, name]) => {
    const holidayDate = fromISO(iso);
    if (holidayDate.getDay() !== 0 && holidayDate.getDay() !== 6) return;
    let substitute = addDays(holidayDate, 1);
    while (substitute.getDay() === 0 || substitute.getDay() === 6 || holidays.has(toISO(substitute))) substitute = addDays(substitute, 1);
    if (substitute.getFullYear() === year) holidays.set(toISO(substitute), `${name} 대체공휴일`);
  });
  return holidays.get(toISO(date));
}
function getCalendarChipStyle(item: CalendarItem): React.CSSProperties | undefined {
  if (item.type === "todo") {
    const color = item.accentColor || "#6659aa";
    return { color, "--todo-color": color } as React.CSSProperties;
  }
  return item.type === "event" ? { "--event-color": item.accentColor || "#c96f62" } as React.CSSProperties : undefined;
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

function createCalendarFeatureTestItems(today: Date): CalendarItem[] {
  const lunar = getLunarMonthDay(today);
  return [
    { id: "demo-lunar-birthday", type: "event", title: "음력 생일 테스트", date: toISO(today), time: "10:00", category: "가족", calendarKind: "lunar", lunarMonth: lunar.month, lunarDay: lunar.day, lunarLeapMonth: lunar.lunarLeapMonth, recurrence: "yearly", repeatUntil: toISO(addYears(today, 3)), accentColor: "#e98272" },
    { id: "demo-weekly-todo", type: "todo", title: "매주 장보기 테스트", date: toISO(addDays(today, 1)), category: "집안일", recurrence: "weekly", repeatUntil: toISO(addDays(today, 29)), accentColor: "#6f63b6" },
    { id: "demo-monthly-expense", type: "expense", title: "반복 구독료 테스트", date: toISO(addDays(today, 2)), amount: 9900, category: "구독", recurrence: "monthly", repeatUntil: toISO(addMonths(today, 3)), expectedExpense: true },
    { id: "demo-expected-income", type: "income", title: "예상 부수입 테스트", date: toISO(addDays(today, 4)), amount: 150000, category: "부수입", expectedIncome: true },
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
    endDate: type === "event" ? date : "",
    time: type === "event" ? "12:00" : "",
    amount: "",
    category: categoryMap[type][0],
    note: "",
    expectedIncome: false,
    expectedExpense: false,
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
    transferFrom: "",
    transferTo: "",
    dueDate: date,
    autopay: false,
    paymentStatus: "scheduled",
    calendarKind: "solar",
    lunarMonth: undefined,
    lunarDay: undefined,
    autopayAccount: "",
  };
}

function isLocalCurrencyTransfer(item: CalendarItem) {
  return item.category === "지역화폐 충전" && (item.type === "transfer" || item.type === "expense");
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
      {isFinance && <span className={`item-amount ${item.type === "income" ? "positive" : ""}`}>{item.type === "income" ? "+" : "−"}{formatCompact(item.amount)}{item.type === "income" && item.expectedIncome ? " · 예상" : ""}</span>}
      {item.type === "todo" && (
        <span
          className={`check-control ${item.completed ? "checked" : ""}`}
          style={{ "--todo-color": item.accentColor || meta.color } as React.CSSProperties}
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
  const shareLinkMode = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("share") === "empty", []);
  const [shareGuestUnlocked, setShareGuestUnlocked] = useState(false);
  const shareGuestMode = shareLinkMode && !shareGuestUnlocked;
  const auth = useAuth();
  const accountCloudQuery = trpc.accountCloud.get.useQuery(undefined, { enabled: auth.isAuthenticated && !shareGuestMode, refetchInterval: auth.isAuthenticated && !shareGuestMode ? 5000 : false, refetchOnWindowFocus: true });
  const accountCloudSync = trpc.accountCloud.sync.useMutation();
  const familyQuery = trpc.family.get.useQuery(undefined, { enabled: auth.isAuthenticated && !shareGuestMode, refetchInterval: auth.isAuthenticated && !shareGuestMode ? 5000 : false });
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
  const [lockScreenConfig, setLockScreenConfig] = useState<LockScreenConfig>(DEFAULT_LOCKSCREEN_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedStorageScope, setLoadedStorageScope] = useState<string | null>(null);
  const accountStorageScope = shareGuestMode ? "__empty_share_guest__" : (auth.user?.openId ?? "");
  const marketSymbols = useMemo(() => [...new Set(assetBalances.filter((asset) => (asset.kind === "stock" || asset.kind === "crypto") && asset.ticker?.trim()).map((asset) => asset.kind === "crypto" && !asset.ticker!.toUpperCase().startsWith("BITHUMB:") ? `BITHUMB:${asset.ticker!.trim().toUpperCase().replace(/-/g, "_")}` : asset.ticker!.trim().toUpperCase()))], [assetBalances]);
  const marketQuotesQuery = trpc.market.quotes.useQuery({ symbols: marketSymbols }, { enabled: marketSymbols.length > 0, refetchInterval: marketSymbols.length > 0 ? 60_000 : false, refetchOnWindowFocus: true });
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => createDraft(todayISO));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [isGeneratingWallpaper, setIsGeneratingWallpaper] = useState(false);
  const [wallpaperMessage, setWallpaperMessage] = useState<string | null>(null);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [isAssetManagerOpen, setAssetManagerOpen] = useState(false);
  const [isFamilyOpen, setFamilyOpen] = useState(false);
  const [isTutorialOpen, setTutorialOpen] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("daldal-calendar-tutorial-seen") !== "1");
  const [familyName, setFamilyName] = useState("우리 가족 가계부");
  const [familyInviteCode, setFamilyInviteCode] = useState("");
  const [familyMessage, setFamilyMessage] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{ version: number; remoteRecords: CalendarItem[] } | null>(null);
  const lastFamilySignature = useRef<string | null>(null);
  const cloudVersionRef = useRef(0);
  const cloudHydratedScopeRef = useRef<string | null>(null);
  const cloudSignatureRef = useRef<string | null>(null);
  const lastSyncedRecords = useRef<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const resetInProgressRef = useRef(false);
  const categoryMap = useMemo<CategoryMap>(() => ({
    ...categories,
    income: [...categories.income, ...(customCategories.income ?? [])],
    expense: [...categories.expense, ...(customCategories.expense ?? [])],
    loan: [...categories.loan, ...(customCategories.loan ?? [])],
  }), [customCategories]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); void accountCloudQuery.refetch(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [accountCloudQuery]);
  useEffect(() => {
    resetInProgressRef.current = false;
    cloudHydratedScopeRef.current = null;
    cloudVersionRef.current = 0;
    cloudSignatureRef.current = null;
  }, [accountStorageScope]);
  useEffect(() => {
    if (!marketQuotesQuery.data?.length) return;
    const quotes = new Map(marketQuotesQuery.data.map((quote) => [quote.symbol.toUpperCase(), quote]));
    setAssetBalances((current) => {
      let changed = false;
      const next = current.map((asset) => {
        const ticker = asset.ticker && asset.kind === "crypto" && !asset.ticker.toUpperCase().startsWith("BITHUMB:") ? `BITHUMB:${asset.ticker.trim().toUpperCase().replace(/-/g, "_")}` : asset.ticker?.trim().toUpperCase();
        const quote = ticker ? quotes.get(ticker) : undefined;
        if (!quote || (asset.currentPrice === quote.price && asset.priceUpdatedAt === quote.observedAt)) return asset;
        changed = true;
        return { ...asset, currentPrice: quote.price, priceCurrency: quote.currency, nativePrice: quote.nativePrice, nativeCurrency: quote.nativeCurrency, fxRate: quote.fxRate, priceUpdatedAt: quote.observedAt };
      });
      return changed ? next : current;
    });
  }, [marketQuotesQuery.data]);
  useEffect(() => {
    if (auth.loading) return;
    const scope = accountStorageScope;
    setIsLoaded(false);
    setLoadedStorageScope(null);
    try {
      if (shareGuestMode) {
        setItems([]);
        setCustomCategories({ income: [], expense: [], loan: [] });
        setMonthlyBudgets({});
        setEmergencyReserve(0);
        setAssetBalances([]);
        setLockScreenConfig(DEFAULT_LOCKSCREEN_CONFIG);
        setLoadedStorageScope(scope);
        setIsLoaded(true);
        return;
      }
      const read = (key: string) => {
        const scopedKey = scopedStorageKey(key, scope);
        const scopedValue = window.localStorage.getItem(scopedKey);
        if (scopedValue !== null || !scope) return scopedValue;
        const legacyValue = window.localStorage.getItem(key);
        if (legacyValue !== null) {
          window.localStorage.setItem(scopedKey, legacyValue);
          window.localStorage.removeItem(key);
        }
        return legacyValue;
      };
      const saved = read(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
      const savedCategories = read(CATEGORY_STORAGE_KEY);
      if (savedCategories) setCustomCategories(JSON.parse(savedCategories));
      const savedBudgets = read(BUDGET_STORAGE_KEY);
      if (savedBudgets) setMonthlyBudgets(JSON.parse(savedBudgets));
      const savedReserve = read(RESERVE_STORAGE_KEY);
      if (savedReserve) setEmergencyReserve(Number(savedReserve) || 0);
      const savedAssets = read(ASSET_BALANCE_STORAGE_KEY);
      if (savedAssets) setAssetBalances(JSON.parse(savedAssets) as AssetBalance[]);
      const savedLockScreen = read(LOCKSCREEN_STORAGE_KEY);
      if (savedLockScreen) setLockScreenConfig({ ...DEFAULT_LOCKSCREEN_CONFIG, ...JSON.parse(savedLockScreen) });
    } catch {
      // Keep the starter entries if local storage is unavailable.
    } finally {
      setLoadedStorageScope(scope);
      setIsLoaded(true);
    }
  }, [auth.loading, accountStorageScope, shareGuestMode]);

  useEffect(() => {
    if (resetInProgressRef.current || auth.loading || !auth.isAuthenticated || !accountStorageScope || !isLoaded || loadedStorageScope !== accountStorageScope || accountCloudQuery.isLoading) return;
    if (cloudHydratedScopeRef.current === accountStorageScope) return;
    const remote = accountCloudQuery.data;
    if (remote?.payloadJson) {
      try {
        const payload = JSON.parse(remote.payloadJson) as Partial<{ items: CalendarItem[]; customCategories: Partial<Record<ItemType, string[]>>; monthlyBudgets: Record<string, { expense: number; loan: number; categories?: Record<string, number> }>; emergencyReserve: number; assetBalances: AssetBalance[]; lockScreenConfig: LockScreenConfig }>;
        if (Array.isArray(payload.items)) setItems(payload.items);
        if (payload.customCategories) setCustomCategories(payload.customCategories);
        if (payload.monthlyBudgets) setMonthlyBudgets(payload.monthlyBudgets);
        if (typeof payload.emergencyReserve === "number") setEmergencyReserve(payload.emergencyReserve);
        if (Array.isArray(payload.assetBalances)) setAssetBalances(payload.assetBalances);
        if (payload.lockScreenConfig) setLockScreenConfig({ ...DEFAULT_LOCKSCREEN_CONFIG, ...payload.lockScreenConfig });
        cloudVersionRef.current = remote.version;
        cloudSignatureRef.current = remote.payloadJson;
      } catch {
        cloudVersionRef.current = remote.version;
      }
    } else {
      cloudVersionRef.current = 0;
    }
    cloudHydratedScopeRef.current = accountStorageScope;
  }, [accountCloudQuery.data, accountCloudQuery.isLoading, accountStorageScope, auth.isAuthenticated, auth.loading, isLoaded, loadedStorageScope]);

  useEffect(() => {
    const remote = accountCloudQuery.data;
    if (resetInProgressRef.current || !remote || !auth.isAuthenticated || cloudHydratedScopeRef.current !== accountStorageScope || accountCloudSync.isPending || remote.version <= cloudVersionRef.current) return;
    try {
      const payload = JSON.parse(remote.payloadJson) as Partial<{ items: CalendarItem[]; customCategories: Partial<Record<ItemType, string[]>>; monthlyBudgets: Record<string, { expense: number; loan: number; categories?: Record<string, number> }>; emergencyReserve: number; assetBalances: AssetBalance[]; lockScreenConfig: LockScreenConfig }>;
      if (Array.isArray(payload.items)) setItems(payload.items);
      if (payload.customCategories) setCustomCategories(payload.customCategories);
      if (payload.monthlyBudgets) setMonthlyBudgets(payload.monthlyBudgets);
      if (typeof payload.emergencyReserve === "number") setEmergencyReserve(payload.emergencyReserve);
      if (Array.isArray(payload.assetBalances)) setAssetBalances(payload.assetBalances);
      if (payload.lockScreenConfig) setLockScreenConfig({ ...DEFAULT_LOCKSCREEN_CONFIG, ...payload.lockScreenConfig });
      cloudVersionRef.current = remote.version;
      cloudSignatureRef.current = remote.payloadJson;
    } catch {}
  }, [accountCloudQuery.data, accountCloudSync.isPending, accountStorageScope, auth.isAuthenticated]);

  const cloudPayloadJson = useMemo(() => JSON.stringify({ items, customCategories, monthlyBudgets, emergencyReserve, assetBalances, lockScreenConfig }), [items, customCategories, monthlyBudgets, emergencyReserve, assetBalances, lockScreenConfig]);
  useEffect(() => {
    if (!isOnline || !auth.isAuthenticated || !accountStorageScope || !isLoaded || loadedStorageScope !== accountStorageScope || cloudHydratedScopeRef.current !== accountStorageScope || accountCloudSync.isPending || cloudPayloadJson === cloudSignatureRef.current) return;
    const timer = window.setTimeout(() => {
      accountCloudSync.mutate({ payloadJson: cloudPayloadJson, baseVersion: cloudVersionRef.current }, { onSuccess: (result) => {
        if (result.conflict) {
          try {
            const remote = JSON.parse(result.payloadJson) as Partial<{ items: CalendarItem[] }>;
            if (Array.isArray(remote.items)) {
              const merged = new Map<string, CalendarItem>();
              remote.items.forEach((item) => merged.set(item.id, item));
              items.forEach((item) => merged.set(item.id, item));
              setItems(Array.from(merged.values()));
            }
          } catch {}
          cloudVersionRef.current = result.version;
          cloudSignatureRef.current = result.payloadJson;
        } else {
          cloudVersionRef.current = result.version;
          cloudSignatureRef.current = cloudPayloadJson;
        }
      } });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [accountCloudSync, accountStorageScope, auth.isAuthenticated, cloudPayloadJson, isLoaded, isOnline, items, loadedStorageScope]);

  useEffect(() => {
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(STORAGE_KEY, accountStorageScope), JSON.stringify(items));
  }, [items, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    const remote = familyQuery.data;
    if (resetInProgressRef.current || !isLoaded || !remote || conflictState || lastFamilySignature.current === remote.updatedAt) return;
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
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(CATEGORY_STORAGE_KEY, accountStorageScope), JSON.stringify(customCategories));
  }, [customCategories, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(BUDGET_STORAGE_KEY, accountStorageScope), JSON.stringify(monthlyBudgets));
  }, [monthlyBudgets, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(RESERVE_STORAGE_KEY, accountStorageScope), String(emergencyReserve));
  }, [emergencyReserve, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(ASSET_BALANCE_STORAGE_KEY, accountStorageScope), JSON.stringify(assetBalances));
  }, [assetBalances, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    if (isLoaded && loadedStorageScope === accountStorageScope) window.localStorage.setItem(scopedStorageKey(LOCKSCREEN_STORAGE_KEY, accountStorageScope), JSON.stringify(lockScreenConfig));
  }, [lockScreenConfig, isLoaded, loadedStorageScope, accountStorageScope]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleMonthStart = toISO(new Date(month.getFullYear(), month.getMonth(), 1, 12));
  const visibleMonthEnd = toISO(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12));
  const displayItems = useMemo(() => getDisplayItems(items, visibleMonthStart, visibleMonthEnd), [items, visibleMonthStart, visibleMonthEnd]);
  const monthItems = useMemo(() => getMonthItems(displayItems, month), [displayItems, month]);
  const localCurrencyBalances = useMemo(() => {
    const initial = assetBalances.filter((asset) => asset.kind === "localCurrency").reduce<Record<string, number>>((balances, asset) => ({ ...balances, [asset.name]: asset.initialBalance ?? 0 }), {});
    return displayItems.reduce<Record<string, number>>((balances, item) => {
      const target = item.localCurrencyTarget || (item.paymentMethod === "localCurrency" ? item.assetName : undefined);
      if (!target) return balances;
      const amount = item.category === "지역화폐 충전" ? (item.localCurrencyLoadedAmount ?? item.amount ?? 0) : item.paymentMethod === "localCurrency" ? -(item.amount ?? 0) + (item.localCurrencyCashbackAmount ?? 0) : 0;
      return { ...balances, [target]: (balances[target] ?? 0) + amount };
    }, initial);
  }, [assetBalances, displayItems]);
  const monthlyCardSpend = useMemo(() => monthItems.filter((item) => item.type === "expense" && !isLocalCurrencyTransfer(item) && item.paymentMethod === "card" && item.cardCompany).reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.cardCompany as string]: (totals[item.cardCompany as string] ?? 0) + (item.amount ?? 0) }), {}), [monthItems]);
  const selectedItems = useMemo(() => displayItems.filter((item) => isDateInRange(item, selectedDate)), [displayItems, selectedDate]);
  const todayItems = useMemo(() => displayItems.filter((item) => isDateInRange(item, todayISO)), [displayItems, todayISO]);
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
      lockScreenConfig,
      lunarCalendar: JSON.stringify(Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
        const lunar = getLunarMonthDay(date);
        return { date: toISO(date), label: `${lunar.month}.${lunar.day}` };
      })),
      // 잠금화면은 앱이 열려 있지 않아도 현재 연·월을 다시 계산해야 하므로
      // 화면에 펼친 한 달치가 아니라 일정·할 일 원본과 반복 정보를 전달합니다.
      calendarItems: JSON.stringify(items.filter((item) => item.type === "event" || item.type === "todo").map(({ id, type, title, date, endDate, time, amount, completed, completedDates, expectedIncome, expectedExpense, accentColor, category, recurrence, repeatUntil, calendarKind, lunarMonth, lunarDay, lunarLeapMonth }) => ({ id, type, title, date, endDate, time, amount, completed, completedDates, expectedIncome, expectedExpense, accentColor, category, recurrence, repeatUntil, calendarKind, lunarMonth, lunarDay, lunarLeapMonth }))),
    });
  }, [todayISO, todayTodos, todayEvents, monthSummary.balance, month, items, lockScreenConfig]);

  const openCreate = (type: ItemType = "todo", date = selectedDate) => {
    setEditingId(null);
    setDraft(createDraft(date, type, categoryMap));
    setComposerOpen(true);
  };

  const openEdit = (item: CalendarItem) => {
    const generatedSourceId = item.sourceLoanId ?? item.id.split("-repeat-")[0].split("-due")[0];
    const sourceItem = items.find((candidate) => candidate.id === generatedSourceId) ?? item;
    setEditingId(sourceItem.id);
    setDraft({
      type: sourceItem.type,
      title: sourceItem.title,
      date: sourceItem.date,
      endDate: sourceItem.endDate ?? sourceItem.date,
      time: sourceItem.time ?? "",
      amount: sourceItem.amount ? String(sourceItem.amount) : "",
      category: sourceItem.category ?? categoryMap[sourceItem.type][0],
      note: sourceItem.note ?? "",
      expectedIncome: Boolean(sourceItem.expectedIncome),
      expectedExpense: Boolean(sourceItem.expectedExpense),
      loanPrincipal: sourceItem.loanPrincipal ? String(sourceItem.loanPrincipal) : "",
      interestRate: sourceItem.interestRate ? String(sourceItem.interestRate) : "",
      gracePeriod: sourceItem.gracePeriod ? String(sourceItem.gracePeriod) : "0",
      repaymentDate: sourceItem.repaymentDate ?? sourceItem.date,
      repaymentMethod: sourceItem.repaymentMethod ?? "equalPayment",
      termMonths: sourceItem.termMonths ? String(sourceItem.termMonths) : "60",
      recurrence: sourceItem.recurrence ?? "none",
      repeatUntil: sourceItem.repeatUntil ?? "",
      calendarKind: sourceItem.calendarKind ?? "solar",
      lunarMonth: sourceItem.lunarMonth,
      lunarDay: sourceItem.lunarDay,
      lunarLeapMonth: sourceItem.lunarLeapMonth,
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
      transferFrom: sourceItem.transferFrom ?? "",
      transferTo: sourceItem.transferTo ?? "",
      dueDate: sourceItem.dueDate ?? sourceItem.repaymentDate ?? sourceItem.date,
      autopay: Boolean(sourceItem.autopay),
      autopayAccount: sourceItem.autopayAccount ?? "",
      paymentStatus: sourceItem.paymentStatus ?? "scheduled",
    });
    setComposerOpen(true);
  };

  const saveItem = () => {
    if (!draft.title.trim()) return;
    const isLocalCurrency = ["expense", "transfer"].includes(draft.type) && draft.category === "지역화폐 충전";
    const isLocalCurrencyPurchase = draft.type === "expense" && draft.paymentMethod === "localCurrency";
    const localCurrencyRate = isLocalCurrency ? Math.min(100, Math.max(0, Number(draft.localCurrencyDiscountRate || 0))) : undefined;
    const localCurrencyLoadedAmount = isLocalCurrency ? Math.round(Number(draft.amount || 0) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)) : undefined;
    const localCurrencyCashbackRate = isLocalCurrencyPurchase ? Math.min(100, Math.max(0, Number(draft.localCurrencyCashbackRate || 0))) : undefined;
    const localCurrencyCashbackAmount = isLocalCurrencyPurchase ? Math.round(Number(draft.amount || 0) * Number(localCurrencyCashbackRate || 0) / 100) : undefined;
    const nextItem: CalendarItem = {
      id: editingId ?? `item-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      type: isLocalCurrency ? "transfer" : draft.type,
      title: draft.title.trim(),
      date: draft.date,
      endDate: draft.type === "event" ? (draft.endDate || draft.date) : undefined,
      time: draft.type === "event" ? draft.time : undefined,
      amount: ["income", "expense", "transfer", "loan", "savings"].includes(draft.type) && draft.amount ? Number(draft.amount.replace(/,/g, "")) : undefined,
      category: draft.category,
      note: draft.note.trim() || undefined,
      completed: editingId ? items.find((item) => item.id === editingId)?.completed : false,
      completedDates: editingId ? items.find((item) => item.id === editingId)?.completedDates : undefined,
      expectedIncome: draft.type === "income" ? draft.expectedIncome : undefined,
      expectedExpense: draft.type === "expense" ? draft.expectedExpense : undefined,
      loanPrincipal: draft.type === "loan" && draft.loanPrincipal ? Number(draft.loanPrincipal.replace(/,/g, "")) : undefined,
      interestRate: draft.type === "loan" && draft.interestRate ? Number(draft.interestRate) : undefined,
      gracePeriod: draft.type === "loan" && draft.gracePeriod ? Number(draft.gracePeriod) : undefined,
      repaymentDate: draft.type === "loan" ? draft.repaymentDate : undefined,
      repaymentMethod: draft.type === "loan" ? draft.repaymentMethod : undefined,
      termMonths: draft.type === "loan" && draft.termMonths ? Number(draft.termMonths) : undefined,
      recurrence: ["todo", "event", "expense", "loan", "savings"].includes(draft.type) ? (draft.type === "savings" ? "monthly" : draft.recurrence) : undefined,
      repeatUntil: ["todo", "event", "expense", "loan", "savings"].includes(draft.type) && (draft.type === "savings" || draft.recurrence !== "none") ? draft.type === "savings" ? draft.savingsMaturityDate || toISO(addMonths(fromISO(draft.date), Math.max(1, Number(draft.savingsTermMonths || 12)) - 1)) : draft.repeatUntil : undefined,
      calendarKind: ["todo", "event"].includes(draft.type) ? draft.calendarKind : undefined,
      lunarMonth: ["todo", "event"].includes(draft.type) && draft.calendarKind === "lunar" ? draft.lunarMonth : undefined,
      lunarDay: ["todo", "event"].includes(draft.type) && draft.calendarKind === "lunar" ? draft.lunarDay : undefined,
      lunarLeapMonth: ["todo", "event"].includes(draft.type) && draft.calendarKind === "lunar" ? draft.lunarLeapMonth : undefined,
      owner: ["income", "expense", "loan", "savings"].includes(draft.type) ? draft.owner : undefined,
      accentColor: ["todo", "event"].includes(draft.type) ? draft.accentColor : undefined,
      cardCompany: draft.type === "expense" && draft.paymentMethod === "card" ? draft.cardCompany : draft.type === "loan" && draft.category === "카드값" ? draft.cardCompany : undefined,
      cardMode: draft.type === "loan" && draft.category === "카드값" ? draft.cardMode : undefined,
      installments: draft.type === "loan" && draft.category === "카드값" ? Number(draft.installments) : undefined,
      cardFeeRate: draft.type === "loan" && draft.category === "카드값" ? Number(draft.cardFeeRate) : undefined,
      savingsMaturityDate: draft.type === "savings" ? draft.savingsMaturityDate || undefined : undefined,
      savingsInterestRate: draft.type === "savings" && draft.savingsInterestRate ? Number(draft.savingsInterestRate) : undefined,
      savingsTermMonths: draft.type === "savings" && draft.savingsTermMonths ? Number(draft.savingsTermMonths) : undefined,
      assetKind: isLocalCurrency ? undefined : isLocalCurrencyPurchase ? "localCurrency" : ["income", "expense", "loan", "savings"].includes(draft.type) ? draft.assetKind : undefined,
      assetName: isLocalCurrency ? undefined : isLocalCurrencyPurchase ? draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐" : ["income", "expense", "loan", "savings"].includes(draft.type) && draft.assetName.trim() ? draft.assetName.trim() : undefined,
      paymentMethod: isLocalCurrency ? undefined : draft.type === "expense" ? draft.paymentMethod : undefined,
      localCurrencyDiscountRate: localCurrencyRate,
      localCurrencySource: isLocalCurrency ? draft.localCurrencySource.trim() || draft.assetName.trim() || "주거래 계좌" : undefined,
      localCurrencyTarget: isLocalCurrency || isLocalCurrencyPurchase ? draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐" : undefined,
      localCurrencyLoadedAmount,
      localCurrencyCashbackRate,
      localCurrencyCashbackAmount,
      transferFrom: isLocalCurrency ? draft.localCurrencySource.trim() || draft.assetName.trim() || "주거래 계좌" : draft.type === "transfer" ? draft.transferFrom.trim() || undefined : undefined,
      transferTo: isLocalCurrency ? draft.localCurrencyTarget.trim() || draft.assetName.trim() || "지역화폐" : draft.type === "transfer" ? draft.transferTo.trim() || undefined : undefined,
      dueDate: ["expense", "loan"].includes(draft.type) ? draft.dueDate || draft.date : undefined,
      autopay: ["expense", "loan"].includes(draft.type) ? draft.autopay : undefined,
      autopayAccount: ["expense", "loan"].includes(draft.type) && draft.autopay ? draft.autopayAccount.trim() || undefined : undefined,
      paymentStatus: ["expense", "loan"].includes(draft.type) && draft.dueDate ? draft.paymentStatus : undefined,
    };

    setItems((current) => {
      if (!editingId) return [...current, nextItem];
      const exists = current.some((item) => item.id === editingId);
      return exists ? current.map((item) => item.id === editingId ? nextItem : item) : [...current, nextItem];
    });
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
    const sourceId = item.sourceLoanId ?? item.id;
    const legacyItem = item as CalendarItem & { repeatCycle?: string; repeatType?: string; recurring?: string };
    const recurrence = item.recurrence ?? legacyItem.repeatCycle ?? legacyItem.repeatType ?? legacyItem.recurring ?? "none";
    if (item.type === "todo" && item.sourceLoanId && recurrence !== "none") {
      setItems((current) => current.map((entry) => {
        if (entry.id !== sourceId) return entry;
        const dates = new Set(entry.completedDates ?? []);
        if (dates.has(item.date)) dates.delete(item.date); else dates.add(item.date);
        return { ...entry, completedDates: Array.from(dates).sort() };
      }));
      return;
    }
    setItems((current) => current.map((entry) => entry.id === sourceId ? { ...entry, completed: !entry.completed } : entry));
  };

  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(toISO(next));
  };

  const resetAppData = () => {
    resetInProgressRef.current = true;
    lastSyncedRecords.current = JSON.stringify([]);
    lastFamilySignature.current = null;
    const resetPayload = JSON.stringify({ items: [], customCategories: { income: [], expense: [], loan: [] }, monthlyBudgets: {}, emergencyReserve: 0, assetBalances: [], lockScreenConfig: DEFAULT_LOCKSCREEN_CONFIG });
    [STORAGE_KEY, CATEGORY_STORAGE_KEY, BUDGET_STORAGE_KEY, RESERVE_STORAGE_KEY, ASSET_BALANCE_STORAGE_KEY, LOCKSCREEN_STORAGE_KEY].forEach((key) => {
      window.localStorage.removeItem(key);
      if (accountStorageScope) window.localStorage.removeItem(scopedStorageKey(key, accountStorageScope));
    });
    setItems([]);
    setCustomCategories({ income: [], expense: [], loan: [] });
    setMonthlyBudgets({});
    setEmergencyReserve(0);
    setAssetBalances([]);
    setLockScreenConfig(DEFAULT_LOCKSCREEN_CONFIG);
    setSelectedDate(todayISO);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setViewAndScroll("home");
    cloudSignatureRef.current = null;
    if (auth.isAuthenticated && accountStorageScope && isOnline && cloudHydratedScopeRef.current === accountStorageScope) {
      accountCloudSync.mutate({ payloadJson: resetPayload, baseVersion: cloudVersionRef.current }, { onSuccess: (result) => {
        cloudVersionRef.current = result.version;
        cloudSignatureRef.current = resetPayload;
      } });
    }
  };

  const setViewAndScroll = (nextView: View) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goToTodayCalendar = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayISO);
    setViewAndScroll("calendar");
  };

  const addTestData = () => {
    const fixture = createCalendarFeatureTestItems(today);
    setItems((current) => [...fixture.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
    setSelectedDate(todayISO);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setViewAndScroll("calendar");
    window.alert("음력·반복 일정 테스트 데이터를 달력과 위젯에 추가했어요.");
  };

  const exportBackup = () => {
    const backup = { app: "daldal-calendar", version: 2, exportedAt: new Date().toISOString(), items, customCategories, monthlyBudgets, emergencyReserve, assetBalances, lockScreenConfig };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const fileName = `daldal-calendar-backup-${toISO(new Date())}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
  };

  const importBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result)) as { app?: string; items?: CalendarItem[]; customCategories?: Partial<Record<ItemType, string[]>>; monthlyBudgets?: typeof monthlyBudgets; emergencyReserve?: number; assetBalances?: AssetBalance[]; lockScreenConfig?: LockScreenConfig };
        if (backup.app !== "daldal-calendar" || !Array.isArray(backup.items)) throw new Error("invalid backup");
        setItems(backup.items);
        if (backup.customCategories) setCustomCategories(backup.customCategories);
        if (backup.monthlyBudgets) setMonthlyBudgets(backup.monthlyBudgets);
        if (typeof backup.emergencyReserve === "number") setEmergencyReserve(backup.emergencyReserve);
        if (Array.isArray(backup.assetBalances)) setAssetBalances(backup.assetBalances);
        if (backup.lockScreenConfig) setLockScreenConfig({ ...DEFAULT_LOCKSCREEN_CONFIG, ...backup.lockScreenConfig });
        window.alert("백업을 복원했어요.");
      } catch {
        window.alert("달달 캘린더 백업 파일이 아니에요.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const generateWallpaper = async () => {
    setIsGeneratingWallpaper(true);
    setWallpaperMessage(null);
    try {
      const dataUrl = await createMonthlyWallpaper({ month, items, ...monthSummary, backgroundTheme: lockScreenConfig.backgroundTheme });
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

  const shareEmptyApp = async () => {
    const url = `${window.location.origin}${window.location.pathname}?share=empty`;
    const shareData = { title: "달달 캘린더", text: "로그인 없이 빈 화면으로 시작하는 달달 캘린더 앱이에요.", url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard?.writeText(url); setFamilyMessage("내역이 포함되지 않은 공유 링크를 복사했어요."); }
    } catch { /* 사용자가 공유 창을 닫은 경우 */ }
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
  const loginFromShare = async (email: string, password: string) => { const result = await auth.login(email, password); setShareGuestUnlocked(true); return result; };
  const registerFromShare = async (email: string, password: string, name: string) => { const result = await auth.register(email, password, name); setShareGuestUnlocked(true); return result; };

  return (
    <div className={`app-shell app-theme-${lockScreenConfig.backgroundTheme}`} data-app-theme={lockScreenConfig.backgroundTheme}>
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
          <button className="icon-button share-app-button" type="button" onClick={() => void shareEmptyApp()} aria-label="빈 화면으로 앱 공유"><Share2 size={18} /></button>
          <button className={`sync-button ${familyQuery.data ? "is-synced" : ""}`} type="button" onClick={() => setFamilyOpen(true)}><Cloud size={16} /><span>{familyQuery.data ? "공유 중" : "가족 공유"}</span></button>
          <button className="icon-button" type="button" aria-label="설정" onClick={() => setViewAndScroll("settings")}><Settings2 size={19} /></button>
          <button className="profile-chip profile-chip-button" type="button" onClick={() => setFamilyOpen(true)} aria-label={shareGuestMode ? "공유용 빈 화면" : auth.isAuthenticated ? "내 계정" : "로그인"}>{shareGuestMode ? "게스트" : "나"}</button>
        </div>
      </header>

      <main className="page-content">
        {shareGuestMode && <div className="share-guest-banner"><Share2 size={14} /><span>공유용 빈 화면입니다. 기존 사용자의 로그인·내역은 포함되지 않았어요.</span></div>}
        {view === "home" && (
          <HomeView
            clock={clock}
            today={today}
            todayISO={todayISO}
            todayTodos={todayTodos}
            todayEvents={todayEvents}
            todayItems={todayItems}
            nextItems={nextItems}
            month={month}
            calendarItems={displayItems}
            monthSummary={monthSummary}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={toggleTodo}
            onGoCalendar={goToTodayCalendar}
            formatLongDate={formatLongDate}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            month={month}
            selectedDate={selectedDate}
            selectedItems={selectedItems}
            items={displayItems}
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
            assets={assetBalances}
            items={displayItems}
            onMonthChange={changeMonth}
            onEdit={openEdit}
            onCreate={openCreate}
            onManageCategories={() => setCategoryManagerOpen(true)}
            onManageAssets={() => setAssetManagerOpen(true)}
          />
        )}
        {view === "report" && <CashflowReportView month={month} items={displayItems} budget={monthlyBudgets[`${month.getFullYear()}-${pad(month.getMonth() + 1)}`] ?? { expense: 0, loan: 0, categories: {} }} nextBudget={monthlyBudgets[`${addMonths(month, 1).getFullYear()}-${pad(addMonths(month, 1).getMonth() + 1)}`] ?? { expense: 0, loan: 0, categories: {} }} emergencyReserve={emergencyReserve} onEmergencyReserveChange={setEmergencyReserve} onBudgetChange={(budget: { expense: number; loan: number; categories?: Record<string, number> }) => setMonthlyBudgets((current) => ({ ...current, [`${month.getFullYear()}-${pad(month.getMonth() + 1)}`]: budget }))} onNextBudgetChange={(budget: { expense: number; loan: number; categories?: Record<string, number> }) => setMonthlyBudgets((current) => ({ ...current, [`${addMonths(month, 1).getFullYear()}-${pad(addMonths(month, 1).getMonth() + 1)}`]: budget }))} onMonthChange={changeMonth} onEdit={openEdit} onCreate={(type) => openCreate(type, toISO(month))} />}
        {view === "settings" && <SettingsView lockScreenConfig={lockScreenConfig} onLockScreenConfigChange={setLockScreenConfig} onCreate={(type) => openCreate(type, selectedDate)} onManageCategories={() => setCategoryManagerOpen(true)} onManageAssets={() => setAssetManagerOpen(true)} onFamily={() => setFamilyOpen(true)} onExport={exportBackup} onImport={importBackup} backupInputRef={backupInputRef} onReset={resetAppData} onAddTestData={addTestData} onOpenTutorial={() => setTutorialOpen(true)} />}
      </main>

      <button className="record-button" type="button" onClick={() => openCreate("todo")}>
        <Plus size={20} strokeWidth={2.8} />
        <span>기록하기</span>
      </button>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={view === "home" ? "active" : ""} type="button" onClick={() => setViewAndScroll("home")}><LayoutGrid size={19} /><span>오늘</span></button>
        <button className={view === "calendar" ? "active" : ""} type="button" onClick={goToTodayCalendar}><CalendarDays size={19} /><span>달력</span></button>
        <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => setViewAndScroll("ledger")}><Wallet size={19} /><span>가계부</span></button>
        <button className={view === "report" ? "active" : ""} type="button" onClick={() => setViewAndScroll("report")}><Repeat2 size={19} /><span>현금흐름</span></button>
      </nav>

      {wallpaperMessage && <div className="wallpaper-toast" role="status">{wallpaperMessage}</div>}

      {isFamilyOpen && <FamilyShareSheet authenticated={auth.isAuthenticated && !shareGuestMode} loading={auth.loading} family={familyQuery.data ?? null} familyName={familyName} inviteCode={familyInviteCode} message={familyMessage} conflict={conflictState} userName={auth.user?.name ?? "내 계정"} userEmail={auth.user?.email ?? ""} onLogout={auth.logout} onFamilyNameChange={setFamilyName} onInviteCodeChange={setFamilyInviteCode} onCreate={createFamilySpace} onJoin={joinFamilySpace} onCopy={copyFamilyCode} onResolveConflict={resolveConflict} onRestore={restoreBackup} onLogin={loginFromShare} onRegister={registerFromShare} onClose={() => { setFamilyOpen(false); setFamilyMessage(null); }} />}

      {isComposerOpen && (
        <Composer
          draft={draft}
          editing={Boolean(editingId)}
          onChange={setDraft}
          categoryMap={categoryMap}
          assets={assetBalances}
          monthlyCardSpend={monthlyCardSpend}
          localCurrencyBalances={localCurrencyBalances}
          onClose={() => setComposerOpen(false)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
      {isCategoryManagerOpen && <CategoryManager customCategories={customCategories} onChange={setCustomCategories} onClose={() => setCategoryManagerOpen(false)} />}
      {isAssetManagerOpen && <AssetManager assets={assetBalances} items={displayItems} onChange={setAssetBalances} onClose={() => setAssetManagerOpen(false)} />}
      {isTutorialOpen && <TutorialSheet onClose={() => { window.localStorage.setItem("daldal-calendar-tutorial-seen", "1"); setTutorialOpen(false); }} />}
    </div>
  );
}

function TutorialSheet({ onClose }: { onClose: () => void }) {
  return <div className="sheet-backdrop tutorial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="tutorial-sheet" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="sheet-handle" /><div className="sheet-header"><div><span className="section-eyebrow">FIRST STEPS</span><h2 id="tutorial-title">달달 캘린더 사용 안내</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><p className="tutorial-lead">처음에는 아래 순서대로 한 번만 설정하면 편하게 사용할 수 있어요.</p><ol className="tutorial-list"><li><b>일정·할 일 등록</b><span>하단의 기록하기를 누르고 날짜, 제목, 색상을 선택해요. 반복 일정은 반복 주기와 종료 여부를 함께 설정할 수 있어요.</span></li><li><b>계좌와 자산 등록</b><span>설정 → 자산 관리에서 계좌·현금·지역화폐·주식·코인을 먼저 등록해요. 이후 수입·지출 입력에서 등록된 계좌를 선택할 수 있어요.</span></li><li><b>달력 확인</b><span>달력 메뉴에서 오늘 날짜와 음력, 공휴일, 일정·할 일을 한눈에 확인해요. 할 일 앞의 원을 누르면 완료 처리됩니다.</span></li><li><b>잠금화면 적용</b><span>설정 → 잠금화면 구성에서 표시 항목, 색상, 글자 크기를 고른 뒤 Android 잠금화면 설정에서 달달 캘린더 라이브 배경화면을 선택해요.</span></li><li><b>백업 저장</b><span>설정 → 내 데이터 백업 → 백업 파일 저장을 누르면 JSON 파일이 기기에 저장돼요. 앱을 바꾸거나 재설치하기 전에 저장해 두세요.</span></li></ol><button className="save-button tutorial-close" type="button" onClick={onClose}>사용 시작하기 <Check size={17} /></button></section></div>;
}

function SettingsView({ lockScreenConfig, onLockScreenConfigChange, onCreate, onManageCategories, onManageAssets, onFamily, onExport, onImport, backupInputRef, onReset, onAddTestData, onOpenTutorial }: { lockScreenConfig: LockScreenConfig; onLockScreenConfigChange: (config: LockScreenConfig) => void; onCreate: (type: ItemType) => void; onManageCategories: () => void; onManageAssets: () => void; onFamily: () => void; onExport: () => void; onImport: (event: ChangeEvent<HTMLInputElement>) => void; backupInputRef: RefObject<HTMLInputElement | null>; onReset: () => void; onAddTestData: () => void; onOpenTutorial: () => void }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const confirmReset = () => {
    if (resetText.trim() !== "초기화") return;
    onReset();
    setResetOpen(false);
    setResetText("");
  };
  return <div className="settings-view view-stack"><div className="page-title-row"><div><span className="section-eyebrow">SETTINGS</span><h1>설정과 관리</h1><p>자주 쓰는 순서대로 정리해 두었어요.</p></div></div><section className="settings-steps"><button type="button" onClick={onOpenTutorial}><span className="settings-step-number">00</span><span><strong>처음 사용 안내</strong><small>등록·백업·잠금화면 설정 순서를 다시 볼 수 있어요.</small></span><Sparkles size={17} /></button><button type="button" onClick={() => onCreate("expense")}><span className="settings-step-number">01</span><span><strong>기록 추가</strong><small>일정·할 일·수입·지출·이체를 바로 기록해요.</small></span><Plus size={17} /></button><button type="button" onClick={onManageAssets}><span className="settings-step-number">02</span><span><strong>자산 관리</strong><small>계좌·카드·현금·지역화폐와 초기 잔액을 관리해요.</small></span><WalletCards size={17} /></button><button type="button" onClick={onManageCategories}><span className="settings-step-number">03</span><span><strong>카테고리 관리</strong><small>AI 분류에 사용할 카테고리를 추가하거나 정리해요.</small></span><ListChecks size={17} /></button><button type="button" onClick={onFamily}><span className="settings-step-number">04</span><span><strong>가족 공유</strong><small>신랑과 장부를 공유하고 충돌·백업을 관리해요.</small></span><Users size={17} /></button></section><section className="lockscreen-settings surface-card"><SectionHeading eyebrow="LIVE LOCKSCREEN" title="잠금화면 구성" /><p className="settings-description">잠금화면에 보일 요소를 직접 선택할 수 있어요. 변경하면 잠금화면에 자동으로 반영됩니다.</p><div className="lockscreen-presets"><div className="lockscreen-presets-heading"><strong>추천 조합</strong><small>누르면 배경·포인트 색상·글자 크기를 한 번에 적용해요.</small></div><div className="lockscreen-preset-grid">{LOCKSCREEN_PRESETS.map((preset) => { const isSelected = lockScreenConfig.backgroundTheme === preset.theme && lockScreenConfig.customBackgroundColor.toUpperCase() === preset.background && lockScreenConfig.customAccentColor.toUpperCase() === preset.accent && lockScreenConfig.fontScale === preset.fontScale; return <button type="button" className={`lockscreen-preset ${isSelected ? "selected" : ""} ${preset.theme === "night" ? "dark" : ""}`} onClick={() => onLockScreenConfigChange({ ...lockScreenConfig, backgroundTheme: preset.theme, customBackgroundColor: preset.background, customAccentColor: preset.accent, fontScale: preset.fontScale })} key={preset.id}><span className="preset-swatches"><i style={{ backgroundColor: preset.background }} /><i style={{ backgroundColor: preset.accent }} /></span><span className="preset-copy"><strong>{preset.label}</strong><small>{preset.description}</small></span><span className="preset-check" aria-hidden="true">{isSelected ? "✓" : ""}</span></button>; })}</div></div><div className="lockscreen-toggle-list">{([
  ["showCalendar", "월간 달력", "달력과 날짜별 기록 표시"],
  ["showSchedule", "일정", "오늘 일정 표시"],
  ["showTodo", "할 일", "오늘 할 일 표시"],
] as const).map(([key, label, description]) => <label className="lockscreen-toggle-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={lockScreenConfig[key]} onChange={(event) => onLockScreenConfigChange({ ...lockScreenConfig, [key]: event.target.checked })} /></label>)}</div><div className="lockscreen-theme-picker"><strong>배경 테마</strong><div className="theme-choice-list">{([
  ["ivory", "아이보리", "#f9f6f2"],
  ["blush", "살구 핑크", "#fff0ed"],
  ["sage", "세이지", "#edf5f0"],
  ["night", "차분한 밤", "#25232a"],
] as const).map(([value, label, color]) => <button type="button" className={`theme-choice ${lockScreenConfig.backgroundTheme === value ? "selected" : ""}`} onClick={() => onLockScreenConfigChange({ ...lockScreenConfig, backgroundTheme: value })} key={value}><i style={{ backgroundColor: color }} /><span>{label}</span></button>)}</div></div><div className="lockscreen-customizer"><label className="field-label">글자 크기<select value={lockScreenConfig.fontScale} onChange={(event) => onLockScreenConfigChange({ ...lockScreenConfig, fontScale: event.target.value as LockScreenConfig["fontScale"] })}><option value="small">작게</option><option value="medium">기본</option><option value="large">크게</option></select></label><label className="field-label">배경 색상<input type="color" value={lockScreenConfig.customBackgroundColor || "#f9f6f2"} onChange={(event) => onLockScreenConfigChange({ ...lockScreenConfig, customBackgroundColor: event.target.value })} /></label><label className="field-label">포인트 색상<input type="color" value={lockScreenConfig.customAccentColor || "#d87568"} onChange={(event) => onLockScreenConfigChange({ ...lockScreenConfig, customAccentColor: event.target.value })} /></label></div><small className="backup-note">날짜·요일 텍스트는 표시하지 않습니다. 색상과 글자 크기는 잠금화면에 자동 반영됩니다.</small></section><section className="backup-section surface-card"><SectionHeading eyebrow="BACKUP" title="내 데이터 백업" /><p className="settings-description">기록·카테고리·예산·자산 잔액을 하나의 파일로 저장해요. 휴대폰을 바꾸거나 앱을 다시 설치할 때 복원할 수 있어요.</p><div className="backup-actions"><button className="primary-button" type="button" onClick={onExport}><Download size={16} /> 백업 파일 저장</button><button className="secondary-button" type="button" onClick={() => backupInputRef.current?.click()}><Upload size={16} /> 백업 파일 복원</button><button className="secondary-button" type="button" onClick={onAddTestData}>음력·반복 테스트 데이터 추가</button><input ref={backupInputRef} type="file" accept="application/json,.json" onChange={onImport} hidden /></div><small className="backup-note">백업 파일은 기기 안에 저장됩니다. 다른 사람에게 공유하지 마세요.</small></section><section className="reset-section surface-card"><div><span className="section-eyebrow">DANGER ZONE</span><h2>앱 초기화</h2><p>이 기기의 기록·카테고리·예산·자산·잠금화면 설정을 지웁니다. 로그인 계정과 가족 공유 서버 데이터는 삭제하지 않습니다.</p></div><button className="danger-button" type="button" onClick={() => setResetOpen(true)}><Trash2 size={15} /> 초기화</button></section>{resetOpen && <div className="reset-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div className="reset-dialog"><button className="reset-close" type="button" aria-label="닫기" onClick={() => { setResetOpen(false); setResetText(""); }}><X size={18} /></button><span className="reset-icon"><Trash2 size={20} /></span><h2 id="reset-title">앱 데이터를 초기화할까요?</h2><p>삭제한 데이터는 되돌릴 수 없습니다. 먼저 백업 파일을 저장했는지 확인하세요.</p><label>확인을 위해 <strong>초기화</strong>를 입력하세요<input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder="초기화" autoFocus /></label><div className="reset-actions"><button className="secondary-button" type="button" onClick={() => { setResetOpen(false); setResetText(""); }}>취소</button><button className="danger-button" type="button" disabled={resetText.trim() !== "초기화"} onClick={confirmReset}>데이터 지우기</button></div></div></div>}</div>;
}

function HomeView({
  clock,
  today,
  todayISO,
  todayTodos,
  todayEvents,
  todayItems,
  nextItems,
  month,
  calendarItems,
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
  month: Date;
  calendarItems: CalendarItem[];
  monthSummary: { income: number; expense: number; loan: number; balance: number };
  onCreate: (type?: ItemType, date?: string) => void;
  onEdit: (item: CalendarItem) => void;
  onToggle: (item: CalendarItem) => void;
  onGoCalendar: () => void;
  formatLongDate: (value: string) => string;
}) {
  const clockText = clock.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateNumber = today.getDate();
  const homeCells = getCalendarCells(month);
  const homeMonthStart = toISO(new Date(month.getFullYear(), month.getMonth(), 1, 12));
  const homeMonthEnd = toISO(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12));
  const homeMonthItems = calendarItems.filter((item) => item.date <= homeMonthEnd && (!item.endDate || item.endDate >= homeMonthStart));
  const homeFinanceItems = todayItems.filter((item) => ["income", "expense", "loan"].includes(item.type));
  return (
    <div className="view-stack home-view">
      <section className="home-calendar-first surface-card">
        <div className="home-calendar-heading"><div><span className="section-eyebrow">MONTHLY PLANNER</span><h2>{monthLabel(month)}</h2></div><button className="text-button" type="button" onClick={onGoCalendar}>전체 달력 <ChevronRight size={16} /></button></div>
        <div className="weekday-row">{WEEKDAYS.map((day, index) => <span className={index === 0 ? "sun" : index === 6 ? "sat" : ""} key={day}>{day}</span>)}</div>
        <div className="calendar-grid home-calendar-grid">
          {homeCells.map((date, index) => {
            if (!date) return <div className="calendar-cell empty" key={`home-empty-${index}`} />;
            const iso = toISO(date);
            const dayItems = homeMonthItems.filter((item) => isDateInRange(item, iso));
            const isToday = iso === todayISO;
            const holidayName = getKoreanHolidayName(date);
            const homeChips = sortCalendarChips(dayItems.filter((item) => item.type === "todo" || item.type === "event"));
            return <button className={`calendar-cell ${isToday ? "today" : ""}`} key={iso} type="button" onClick={() => onGoCalendar()}>
              <span className={`calendar-date-line ${holidayName ? "is-holiday" : ""}`} title={holidayName}><span className="calendar-day-number">{date.getDate()}</span><span className="calendar-lunar-date">{formatLunarDate(date)}</span></span>
              <span className="calendar-chips">{homeChips.slice(0, 3).map((item) => { const rangePosition = getRangePosition(item, iso); return <span className={`calendar-chip ${item.type === "todo" ? "todo-chip" : "event-chip"} ${item.type === "event" ? `event-range-${rangePosition}` : ""} ${item.completed ? "is-complete" : ""}`} style={getCalendarChipStyle(item)} key={item.id} role={item.type === "todo" ? "checkbox" : undefined} aria-checked={item.type === "todo" ? item.completed : undefined} title={rangePosition === "start" || rangePosition === "single" ? item.title : undefined} onClick={(event) => { if (item.type === "todo") { event.stopPropagation(); onToggle(item); } }}>{item.type === "todo" && <span className="todo-calendar-check" aria-hidden="true" />}{item.type === "todo" || rangePosition === "start" || rangePosition === "single" ? item.title : ""}</span>; })}{homeChips.length > 3 && <span className="calendar-more">+{homeChips.length - 3}</span>}</span>
            </button>;
          })}
        </div>
      </section>

      <section className="home-category-section">
        <div className="home-category-heading"><span className="section-eyebrow">TODAY</span><h2>오늘의 항목</h2></div>
        <div className="home-category-grid">
          <div className="surface-card today-list-card"><SectionHeading eyebrow="SCHEDULE · TODO" title="일정 · 할 일" action={<button className="mini-add" type="button" onClick={() => onCreate("todo", todayISO)}><Plus size={15} /></button>} /><div className="list-stack">{[...todayEvents, ...todayTodos].length ? [...todayEvents, ...todayTodos].map((item) => <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />) : <EmptyState label="오늘 일정과 할 일을 추가해요" onClick={() => onCreate("todo", todayISO)} />}</div></div>
          <div className="surface-card today-list-card finance-today-card"><SectionHeading eyebrow="MONEY" title="수입 · 지출 · 대출" action={<button className="mini-add" type="button" onClick={() => onCreate("expense", todayISO)}><Plus size={15} /></button>} /><div className="list-stack">{homeFinanceItems.length ? homeFinanceItems.map((item) => <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />) : <EmptyState label="오늘 금융 기록을 추가해요" onClick={() => onCreate("expense", todayISO)} />}</div></div>
        </div>
      </section>

      <div className="today-intro"><div><span className="section-eyebrow">{today.toLocaleDateString("ko-KR", { month: "long" })} {today.getDate()}일</span><h2>오늘은 이렇게 보내요</h2></div></div>

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
              <span className="next-line" style={{ backgroundColor: item.accentColor || typeMeta[item.type].color }} />
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
            const dayItems = items.filter((item) => isDateInRange(item, iso));
            const isSelected = iso === selectedDate;
            const isToday = iso === toISO(new Date());
            const holidayName = getKoreanHolidayName(date);
            const finances = dayItems.filter((item) => ["income", "expense", "loan"].includes(item.type));
            const allChips = sortCalendarChips(dayItems.filter((item) => item.type === "todo" || item.type === "event"));
            const chips = allChips.slice(0, 3)
            return (
              <button className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`} key={iso} type="button" onClick={() => onSelectDate(iso)}>
                <span className={`calendar-date-line ${holidayName ? "is-holiday" : ""}`} title={holidayName}><span className="calendar-day-number">{date.getDate()}</span><span className="calendar-lunar-date">{formatLunarDate(date)}</span></span>
                <span className="calendar-chips">{chips.map((item) => { const rangePosition = getRangePosition(item, iso); return <span className={`calendar-chip ${item.type === "todo" ? "todo-chip" : "event-chip"} ${item.type === "event" ? `event-range-${rangePosition}` : ""} ${item.completed ? "is-complete" : ""}`} style={getCalendarChipStyle(item)} key={item.id} role={item.type === "todo" ? "checkbox" : undefined} aria-checked={item.type === "todo" ? item.completed : undefined} title={rangePosition === "start" || rangePosition === "single" ? item.title : undefined} onClick={(event) => { if (item.type === "todo") { event.stopPropagation(); onToggle(item); } }}>{item.type === "todo" && <span className="todo-calendar-check" aria-hidden="true" />}{item.type === "todo" || rangePosition === "start" || rangePosition === "single" ? item.title : ""}</span>; })}{allChips.length > chips.length && <span className="calendar-more">+{allChips.length - chips.length}</span>}</span>
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
  assets,
  items,
  onMonthChange,
  onEdit,
  onCreate,
  onManageCategories,
  onManageAssets,
}: {
  month: Date;
  monthItems: CalendarItem[];
  summary: { income: number; expense: number; loan: number; balance: number };
  assets: AssetBalance[];
  items: CalendarItem[];
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
      <PortfolioSummary assets={assets} items={items} />
      <section className="ai-analysis-card surface-card"><div className="ai-analysis-head"><span className="ai-spark"><Sparkles size={15} /></span><div><span className="section-eyebrow">AI MONEY INSIGHT</span><strong>카테고리별로 살펴봤어요</strong></div><span className="ai-live">자동 분석</span></div><p>{analysisText}</p><div className="category-analysis-bars">{categoryTotals.length ? categoryTotals.map(([category, amount]) => <div className="category-analysis-row" key={category}><span>{category}</span><div><i style={{ width: `${Math.max(8, (amount / categoryTotals[0][1]) * 100)}%` }} /></div><b>{formatCompact(amount)}원</b></div>) : <span className="analysis-empty">금융 기록을 추가해 보세요.</span>}</div></section>
      <section className="ledger-list-section"><SectionHeading eyebrow="TRANSACTIONS" title="이번 달 기록" action={<button className="text-button" type="button" onClick={() => onCreate("expense", toISO(new Date()))}>빠른 입력 <Plus size={15} /></button>} /><div className="ledger-groups">{Object.keys(grouped).length ? Object.entries(grouped).map(([date, entries]) => <div className="ledger-group" key={date}><div className="ledger-date"><strong>{fromISO(date).getDate()}</strong><span>{fromISO(date).toLocaleDateString("ko-KR", { weekday: "short" })}</span></div><div className="ledger-entries">{entries.map((item) => <button className="ledger-entry" type="button" key={item.id} onClick={() => onEdit(item)}><span className="item-icon" style={{ backgroundColor: typeMeta[item.type].soft, color: typeMeta[item.type].color }}>{(() => { const Icon = typeMeta[item.type].icon; return <Icon size={16} />; })()}</span><span><strong>{item.title}</strong><small>{item.category}{item.assetName ? ` · ${item.assetName}` : ""}{item.type === "expense" && item.paymentMethod ? ` · ${PAYMENT_METHODS.find((method) => method.value === item.paymentMethod)?.label ?? ""}` : ""}</small></span><b className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : "−"}{formatWon(item.amount)}</b><ChevronRight size={15} /></button>)}</div></div>) : <div className="soft-empty">이번 달 금융 기록이 아직 없어요.</div>}</div></section>
    </div>
  );
}

function LedgerStat({ icon: Icon, label, amount, tone }: { icon: LucideIcon; label: string; amount: number; tone: "income" | "expense" | "loan" }) {
  return <div className={`ledger-stat ${tone}`}><span className="stat-icon"><Icon size={16} /></span><span>{label}</span><strong>{formatCompact(amount)}<small>원</small></strong></div>;
}

function PortfolioSummary({ assets, items }: { assets: AssetBalance[]; items: CalendarItem[] }) {
  const investments = assets.filter((asset) => asset.kind === "stock" || asset.kind === "crypto").map((asset) => {
    const cost = (asset.quantity ?? 0) * (asset.averagePurchasePrice ?? 0);
    const value = getAssetCurrentBalance(asset, items);
    return { asset, cost, value, profit: value - cost };
  }).filter((entry) => entry.cost > 0 || entry.value > 0).sort((a, b) => b.value - a.value);
  const totalCost = investments.reduce((sum, entry) => sum + entry.cost, 0);
  const totalValue = investments.reduce((sum, entry) => sum + entry.value, 0);
  const totalProfit = totalValue - totalCost;
  const returnRate = totalCost > 0 ? totalProfit / totalCost * 100 : 0;
  const maxValue = Math.max(...investments.map((entry) => entry.value), 1);
  const lastUpdated = investments.map((entry) => entry.asset.priceUpdatedAt).filter(Boolean).sort().at(-1);
  return <section className="portfolio-summary surface-card"><div className="portfolio-head"><div><span className="section-eyebrow">MY PORTFOLIO</span><strong>투자자산 전체 수익률</strong></div><WalletCards size={18} /></div>{investments.length ? <><div className="portfolio-kpis"><div><span>총 평가액</span><b>{formatWon(totalValue)}</b></div><div><span>총 매수원가</span><b>{formatWon(totalCost)}</b></div><div className={totalProfit >= 0 ? "portfolio-profit" : "portfolio-loss"}><span>평가손익</span><b>{totalProfit >= 0 ? "▲" : "▼"} {formatWon(Math.abs(totalProfit))}</b><small>{totalProfit >= 0 ? "+" : "−"}{Math.abs(returnRate).toFixed(2)}%</small></div></div><div className="portfolio-return-track"><i className={totalProfit < 0 ? "loss" : ""} style={{ width: `${Math.min(100, Math.max(4, Math.abs(returnRate) / Math.max(Math.abs(returnRate), 100) * 100))}%` }} /></div><div className="portfolio-chart">{investments.map(({ asset, value, profit }) => <div className="portfolio-row" key={asset.id}><div className="portfolio-row-head"><span><i className={asset.kind === "crypto" ? "crypto-dot" : "stock-dot"} />{asset.name}</span><b className={profit >= 0 ? "portfolio-profit" : "portfolio-loss"}>{profit >= 0 ? "+" : "−"}{formatCompact(Math.abs(profit))}원</b></div><div className="portfolio-bar-track"><i className={asset.kind === "crypto" ? "crypto-bar" : "stock-bar"} style={{ width: `${Math.max(value ? 6 : 0, value / maxValue * 100)}%` }} /></div><small>{formatWon(value)} · {totalValue ? Math.round(value / totalValue * 100) : 0}%</small></div>)}</div><div className="portfolio-foot"><span>보유 {investments.length}개 · 현재가 기준 자동 갱신</span><span>{lastUpdated ? `최근 ${new Date(lastUpdated).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "현재가 갱신 대기"}</span></div></> : <div className="portfolio-empty">주식이나 코인 자산을 등록하면 전체 평가액과 수익률을 한눈에 보여드려요.<span className="portfolio-empty-hint">톱니바퀴 → 자산 관리에서 주식·코인을 추가하세요.</span></div>}</section>;
}

function CashflowReportView({ month, items, budget, nextBudget, emergencyReserve, onEmergencyReserveChange, onBudgetChange, onNextBudgetChange, onMonthChange, onEdit, onCreate }: { month: Date; items: CalendarItem[]; budget: { expense: number; loan: number; categories?: Record<string, number> }; nextBudget: { expense: number; loan: number; categories?: Record<string, number> }; emergencyReserve: number; onEmergencyReserveChange: (amount: number) => void; onBudgetChange: (budget: { expense: number; loan: number; categories?: Record<string, number> }) => void; onNextBudgetChange: (budget: { expense: number; loan: number; categories?: Record<string, number> }) => void; onMonthChange: (offset: number) => void; onEdit: (item: CalendarItem) => void; onCreate: (type: ItemType) => void }) {
  const monthItems = getMonthItems(items, month).filter((item) => ["income", "expense", "loan", "savings"].includes(item.type)).sort((a, b) => a.date.localeCompare(b.date));
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const expectedIncome = monthItems.filter((item) => item.type === "income" && item.expectedIncome).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const actualIncome = income - expectedIncome;
  const fixed = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !isLocalCurrencyTransfer(item) && item.recurrence === "monthly").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const expense = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !isLocalCurrencyTransfer(item) && item.recurrence !== "monthly").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const expectedExpense = monthItems.filter((item) => item.type === "expense" && item.expectedExpense && !isLocalCurrencyTransfer(item)).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const actualExpenseOnly = monthItems.filter((item) => ["expense", "savings"].includes(item.type) && !item.expectedExpense && !isLocalCurrencyTransfer(item)).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const loan = monthItems.filter((item) => item.type === "loan").reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const outgoing = fixed + expense + loan;
  const actualExpense = actualExpenseOnly;
  const categoryStats = Object.entries(monthItems.filter((item) => item.type === "expense" && !isLocalCurrencyTransfer(item)).reduce<Record<string, CalendarItem[]>>((groups, item) => {
    const key = item.category || "미분류";
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {})).map(([category, records]) => ({ category, records, actual: records.reduce((sum, item) => sum + (item.amount ?? 0), 0), budget: budget.categories?.[category] ?? 0 })).sort((a, b) => b.actual - a.actual);
  const roundRecommendation = (amount: number) => Math.ceil(amount * 1.05 / 1000) * 1000;
  const recommendedCategories = Object.fromEntries(categoryStats.map((stat) => [stat.category, roundRecommendation(stat.actual)]));
  const recommendedBudget = { expense: roundRecommendation(actualExpense), loan: roundRecommendation(loan), categories: recommendedCategories };
  const topCategoryStats = categoryStats.slice(0, 5);
  const maxCategoryActual = Math.max(...topCategoryStats.map((stat) => stat.actual), 1);
  const expenseShare = outgoing ? Math.round((actualExpense / outgoing) * 100) : 0;
  const topCategory = topCategoryStats[0];
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
  const reportMonthKey = toISO(month).slice(0, 7);
  const scheduledPayments = items.filter((item) => ["expense", "loan"].includes(item.type) && (item.dueDate ?? item.date).startsWith(reportMonthKey)).sort((a, b) => (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date));
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
  return <div className="view-stack cashflow-report"><div className="page-title-row"><div><span className="section-eyebrow">CASHFLOW REPORT</span><h2>월별 현금흐름</h2></div><Repeat2 size={24} className="report-mark" /></div><div className="month-switcher"><button className="month-arrow" type="button" onClick={() => onMonthChange(-1)}><ChevronLeft size={18} /></button><strong>{monthLabel(month)}</strong><button className="month-arrow" type="button" onClick={() => onMonthChange(1)}><ChevronRight size={18} /></button></div><section className="cashflow-hero"><span className="section-eyebrow">ESTIMATED MONTH-END</span><strong>{formatWon(income - outgoing)}</strong><p>수입에서 이번 달 예정된 모든 지출을 뺀 금액</p><div className="cashflow-bar"><i style={{ width: `${Math.min(100, income ? Math.max(0, outgoing / income * 100) : 0)}%` }} /></div><small>지출·고정지출·대출 납부 합계 {formatWon(outgoing)}</small></section><section className="cashflow-stat-grid"><div className="cashflow-stat income"><span>수입</span><strong>{formatWon(income)}</strong></div><div className="cashflow-stat fixed"><span>고정지출</span><strong>{formatWon(fixed)}</strong></div><div className="cashflow-stat expense"><span>일반지출</span><strong>{formatWon(expense)}</strong></div><div className="cashflow-stat loan"><span>대출 납부</span><strong>{formatWon(loan)}</strong></div></section><section className="expected-actual-panel surface-card"><SectionHeading eyebrow="EXPECTED VS ACTUAL" title="예상과 실제 비교" /><p className="expected-actual-note">예상으로 표시한 항목과 실제로 기록한 항목을 분리해서 보여줘요.</p><div className="expected-actual-grid"><div className="expected-actual-card income"><span>예상 수입</span><strong>{formatWon(expectedIncome)}</strong><small>실제 수입 {formatWon(actualIncome)}</small></div><div className="expected-actual-card income"><span>실제 수입</span><strong>{formatWon(actualIncome)}</strong><small>예상보다 {formatWon(actualIncome - expectedIncome)} {actualIncome >= expectedIncome ? "많아요" : "적어요"}</small></div><div className="expected-actual-card expense"><span>예상 지출</span><strong>{formatWon(expectedExpense)}</strong><small>실제 지출 {formatWon(actualExpenseOnly)}</small></div><div className="expected-actual-card expense"><span>실제 지출</span><strong>{formatWon(actualExpenseOnly)}</strong><small>예상보다 {formatWon(actualExpenseOnly - expectedExpense)} {actualExpenseOnly >= expectedExpense ? "많아요" : "적어요"}</small></div></div><div className="expected-actual-difference"><span>예상 대비 실제 차이</span><b className={actualIncome - actualExpenseOnly >= expectedIncome - expectedExpense ? "positive" : "negative"}>{formatWon((actualIncome - actualExpenseOnly) - (expectedIncome - expectedExpense))}</b><small>실제 순현금흐름 − 예상 순현금흐름</small></div></section><section className="budget-panel surface-card"><SectionHeading eyebrow="MONTHLY BUDGET" title="예산 대비 실제" /><div className="budget-inputs"><label>지출 예산<input inputMode="numeric" value={budget.expense || ""} onChange={(event) => onBudgetChange({ ...budget, expense: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="예: 1500000" /></label><label>대출 예산<input inputMode="numeric" value={budget.loan || ""} onChange={(event) => onBudgetChange({ ...budget, loan: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="예: 800000" /></label></div><div className="budget-compare"><div className="budget-compare-row"><div><strong>실제 지출</strong><span>{formatWon(actualExpense)} / {formatWon(budget.expense)}</span></div><div className="budget-track"><i className={expenseRatio > 100 ? "over" : ""} style={{ width: `${Math.min(100, expenseRatio)}%` }} /></div><b className={expenseRatio > 100 ? "over-text" : ""}>{budget.expense ? `${Math.round(expenseRatio)}%` : "예산 미설정"}</b></div><div className="budget-compare-row"><div><strong>실제 대출 상환</strong><span>{formatWon(loan)} / {formatWon(budget.loan)}</span></div><div className="budget-track loan-track"><i className={loanRatio > 100 ? "over" : ""} style={{ width: `${Math.min(100, loanRatio)}%` }} /></div><b className={loanRatio > 100 ? "over-text" : ""}>{budget.loan ? `${Math.round(loanRatio)}%` : "예산 미설정"}</b></div></div></section><section className="household-forecast surface-card"><div className="forecast-head"><div><span className="section-eyebrow">HOUSEHOLD SIMULATION</span><strong>가계 전체 순현금흐름 예측</strong></div><PiggyBank size={18} /></div><p className="forecast-note">나와 신랑의 수입을 합산하고, 반복 고정지출과 대출 납부 예정액을 반영한 기본 시뮬레이션이에요.</p><label className="reserve-input">월별 비상 예비비<input inputMode="numeric" value={emergencyReserve || ""} onChange={(event) => onEmergencyReserveChange(Number(event.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="예: 300000" /><small>예상치 못한 병원비·수리비 등을 대비해 매월 예측 지출에 포함합니다.</small></label><div className="forecast-chart">{householdForecast.map((forecast, index) => <div className="forecast-column" key={forecast.month.toISOString()}><div className="forecast-bars"><i className="forecast-income-bar" style={{ height: `${Math.max(forecast.income ? 7 : 0, forecast.income / forecastMax * 100)}%` }} /><i className="forecast-expense-bar" style={{ height: `${Math.max(forecast.expense ? 7 : 0, forecast.expense / forecastMax * 100)}%` }} /></div><strong>{monthShortLabel(forecast.month)}월</strong><b className={forecast.net < 0 ? "negative" : "positive"}>{forecast.net >= 0 ? "+" : "−"}{formatCompact(Math.abs(forecast.net))}</b><small>누적 {formatCompact(forecastCumulative[index])}</small></div>)}</div><div className="forecast-legend"><span><i className="forecast-income-dot" /> 합산 수입</span><span><i className="forecast-expense-dot" /> 지출·대출·예비비</span></div><div className="forecast-total"><span>3개월 후 예상 누적 잔액</span><b>{formatWon(forecastCumulative[forecastCumulative.length - 1] ?? 0)}</b></div></section><section className="net-worth-trend surface-card"><div className="forecast-head"><div><span className="section-eyebrow">YEAR-END NET WORTH</span><strong>연말 순자산 증가 추이</strong></div><Wallet size={18} /></div><p className="forecast-note">적금 납입 원금과 대출 원금 상환분을 합산했어요. 대출 이자는 순자산 증가에서 제외됩니다.</p><div className="net-worth-chart">{yearEndAssetTrend.map((trend, index) => <div className="net-worth-column" key={trend.month.toISOString()}><div className="net-worth-bar-wrap"><i style={{ height: `${Math.max(trend.increase ? 7 : 0, trend.increase / yearEndMax * 100)}%` }} /></div><strong>{monthShortLabel(trend.month)}월</strong><b>{formatCompact(trend.increase)}</b><small>누적 {formatCompact(yearEndCumulative[index])}</small></div>)}</div><div className="net-worth-legend"><span><i className="savings-dot" /> 적금 원금</span><span><i className="principal-dot" /> 대출 원금 감소</span></div><div className="forecast-total"><span>연말까지 예상 순자산 증가</span><b>{formatWon(yearEndCumulative[yearEndCumulative.length - 1] ?? 0)}</b></div></section><section className="next-budget-recommendation surface-card"><div className="recommendation-head"><div><span className="section-eyebrow">SMART FORECAST</span><strong>다음 달 예산 추천</strong></div><Sparkles size={18} /></div><p>이번 달 실제 지출에 5% 여유분을 더해 추천했어요. 현재 다음 달 예산은 {nextBudget.expense || nextBudget.loan ? "설정됨" : "아직 미설정"}이에요.</p><div className="recommendation-grid"><div><span>지출 추천</span><b>{formatWon(recommendedBudget.expense)}</b></div><div><span>대출 추천</span><b>{formatWon(recommendedBudget.loan)}</b></div></div><div className="recommendation-categories">{categoryStats.slice(0, 4).map((stat) => <span key={stat.category}>{stat.category} <b>{formatWon(recommendedCategories[stat.category])}</b></span>)}</div><button className="recommendation-button" type="button" onClick={() => onNextBudgetChange(recommendedBudget)}>추천 금액을 다음 달 예산으로 적용</button></section><section className="category-budget-panel surface-card"><SectionHeading eyebrow="CATEGORY DETAILS" title="카테고리별 지출" /><div className="category-budget-list">{categoryStats.length ? categoryStats.map((stat) => { const ratio = stat.budget ? stat.actual / stat.budget * 100 : 0; return <details className="category-budget-item" key={stat.category}><summary><span className="category-budget-title"><strong>{stat.category}</strong><small>{stat.records.length}건 · 실제 {formatWon(stat.actual)}</small></span><span className="category-budget-summary"><b className={ratio > 100 ? "over-text" : ""}>{stat.budget ? `${Math.round(ratio)}%` : "예산 없음"}</b><ChevronDown size={15} /></span></summary><div className="category-budget-body"><label>이번 달 예산<input inputMode="numeric" value={stat.budget || ""} onChange={(event) => onBudgetChange({ ...budget, categories: { ...(budget.categories ?? {}), [stat.category]: Number(event.target.value.replace(/[^0-9]/g, "")) || 0 } })} placeholder="예산 입력" /></label><div className="category-budget-track"><i className={ratio > 100 ? "over" : ""} style={{ width: `${Math.min(100, ratio)}%` }} /></div><div className="category-detail-list">{stat.records.sort((a, b) => a.date.localeCompare(b.date)).map((item) => <button type="button" className="category-detail-row" key={item.id} onClick={() => onEdit(item)}><span>{fromISO(item.date).getDate()}일</span><strong>{item.title}</strong><b>{formatWon(item.amount)}</b><ChevronRight size={13} /></button>)}</div></div></details>; }) : <div className="soft-empty">이번 달 지출 내역이 없어요.</div>}</div></section><section className="report-analysis-grid"><section className="analysis-card surface-card"><SectionHeading eyebrow="SPENDING MIX" title="카테고리별 지출 분석" /><div className="category-bars">{topCategoryStats.length ? topCategoryStats.map((stat) => <div className="category-bar-row" key={stat.category}><div className="category-bar-label"><span>{stat.category}</span><b>{formatWon(stat.actual)}</b></div><div className="category-bar-track"><i style={{ width: `${Math.max(5, Math.round((stat.actual / maxCategoryActual) * 100))}%` }} /></div><small>{stat.budget ? `예산의 ${Math.round((stat.actual / stat.budget) * 100)}% 사용` : "예산 미설정"}</small></div>) : <div className="soft-empty">지출 기록을 추가하면 분석 그래프가 나타나요.</div>}</div>{topCategory && <div className="analysis-insight"><Sparkles size={14} /><span>이번 달은 <b>{topCategory.category}</b> 지출이 가장 커요. 전체 지출의 {Math.round((topCategory.actual / Math.max(actualExpense, 1)) * 100)}%를 차지합니다.</span></div>}</section><section className="analysis-card surface-card"><SectionHeading eyebrow="FLOW RATIO" title="수입 대비 지출" /><div className="flow-analysis"><div className="flow-donut" style={{ background: `conic-gradient(var(--coral) 0 ${Math.min(100, expenseShare)}%, #eee8e4 ${Math.min(100, expenseShare)}% 100%)` }}><div><strong>{expenseShare}%</strong><span>지출 비중</span></div></div><div className="flow-analysis-legend"><p><i className="income-chart-dot" /><span>수입</span><b>{formatWon(income)}</b></p><p><i className="outgoing-chart-dot" /><span>지출·대출</span><b>{formatWon(outgoing)}</b></p><small>{income >= outgoing ? `이번 달 ${formatWon(income - outgoing)} 여유` : `이번 달 ${formatWon(outgoing - income)} 부족`}</small></div></div></section></section><section className="owner-assets"><div className="owner-asset-card wife"><span>여자 모든 자산</span><strong>{formatWon(ownerNet("나"))}</strong><small>나로 등록된 수입·지출·대출</small></div><div className="owner-asset-card husband"><span>남자 모든 자산</span><strong>{formatWon(ownerNet("신랑"))}</strong><small>신랑으로 등록된 수입·지출·대출</small></div><div className="owner-asset-card joint"><span>공동 자산</span><strong>{formatWon(ownerNet("공동"))}</strong><small>공동으로 등록된 기록</small></div></section><section className="owner-stats surface-card"><SectionHeading eyebrow="OWNER BREAKDOWN" title="소유자별 통계" /><div className="owner-stat-list">{ownerStats.map((stat) => <div className="owner-stat-row" key={stat.owner}><div className="owner-stat-head"><strong>{stat.owner}</strong><b>{formatWon(stat.balance)}</b></div><div className="owner-stat-track"><i className={`owner-stat-bar ${stat.owner === "나" ? "wife-bar" : stat.owner === "신랑" ? "husband-bar" : "joint-bar"}`} style={{ width: `${Math.max(stat.balance ? 5 : 0, Math.abs(stat.balance) / ownerMaxBalance * 100)}%` }} /></div><div className="owner-stat-meta"><span>수입 {formatCompact(stat.income)}원</span><span>지출·대출 {formatCompact(stat.outgoing)}원</span><span>현금흐름 {Math.round((stat.income + stat.outgoing) / totalOwnerFlow * 100)}%</span></div></div>)}</div></section><section className="cashflow-chart surface-card"><SectionHeading eyebrow="TWO-MONTH VIEW" title="자산 잔액 추이" /><div className="chart-legend"><span><i className="income-chart-dot" /> 수입</span><span><i className="outgoing-chart-dot" /> 나갈 돈</span></div><div className="cashflow-bars"><div className="cashflow-bar-group"><div className="cashflow-bar-columns"><span className="chart-value income-value">{formatCompact(income)}</span><i className="chart-bar income-bar" style={{ height: barHeight(income) }} /><span className="chart-value outgoing-value">{formatCompact(outgoing)}</span><i className="chart-bar outgoing-bar" style={{ height: barHeight(outgoing) }} /></div><strong>{monthShortLabel(month)}월</strong><small>잔액 {formatCompact(income - outgoing)}</small></div><div className="cashflow-bar-group"><div className="cashflow-bar-columns"><span className="chart-value income-value">{formatCompact(nextIncome)}</span><i className="chart-bar income-bar" style={{ height: barHeight(nextIncome) }} /><span className="chart-value outgoing-value">{formatCompact(nextOutgoing)}</span><i className="chart-bar outgoing-bar" style={{ height: barHeight(nextOutgoing) }} /></div><strong>{monthShortLabel(addMonths(month, 1))}월</strong><small>잔액 {formatCompact(nextIncome - nextOutgoing)}</small></div></div><div className="chart-insight"><PiggyBank size={15} /> 다음 달 예상 잔액은 <b>{formatWon(nextIncome - nextOutgoing)}</b>이에요.</div></section><section className="cashflow-next surface-card"><div><span className="section-eyebrow">NEXT MONTH</span><strong>다음 달 예정 지출</strong></div><b>{formatWon(nextOutgoing)}</b></section><section className="scheduled-payments surface-card"><SectionHeading eyebrow="UPCOMING PAYMENTS" title="이번 달 결제 예정" action={<div className="scheduled-actions"><button className="text-button" type="button" onClick={() => onCreate("expense")}>결제 추가 <Plus size={14} /></button><button className="text-button muted-action" type="button" onClick={() => onCreate("expense")}>자동이체 추가 <Plus size={14} /></button></div>} /><div className="scheduled-payment-list">{scheduledPayments.length ? scheduledPayments.map((item) => <button className="scheduled-payment-row" type="button" key={`scheduled-${item.id}`} onClick={() => onEdit(item)}><span className="scheduled-date">{fromISO(item.dueDate ?? item.date).getDate()}일</span><span className="cashflow-row-dot" style={{ backgroundColor: item.accentColor || typeMeta[item.type].color }} /><span className="cashflow-row-copy"><strong>{item.title}</strong><small>{item.paymentStatus === "paid" ? "완료" : item.paymentStatus === "missed" ? "미납" : item.autopay ? `자동이체 · ${item.autopayAccount || "출금 계좌 미지정"}` : item.type === "loan" ? "대출 상환" : "직접 결제"}</small></span><b>{formatWon(item.amount)}</b><ChevronRight size={15} /></button>) : <div className="soft-empty">등록된 결제 예정 내역이 없어요.</div>}</div></section><section className="cashflow-list surface-card"><SectionHeading eyebrow="MONTHLY TIMELINE" title="날짜별 현금흐름" />{monthItems.length ? monthItems.map((item) => <button className="cashflow-row" type="button" key={item.id} onClick={() => onEdit(item)}><span className="cashflow-date">{fromISO(item.date).getDate()}일</span><span className="cashflow-row-dot" style={{ backgroundColor: item.accentColor || typeMeta[item.type].color }} /><span className="cashflow-row-copy"><strong>{item.title}</strong><small>{item.type === "income" ? "수입" : item.type === "loan" ? `${item.paymentNumber ? `${item.paymentNumber}회차 · ` : ""}대출 납부` : item.type === "savings" ? "매월 적금 납입" : item.recurrence === "monthly" ? "매월 고정지출" : "일반지출"}</small></span><b className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : "−"}{formatWon(item.amount)}</b><ChevronRight size={15} /></button>) : <div className="soft-empty">이번 달 현금흐름 기록이 없어요.</div>}</section></div>;
}

function getInvestmentCost(asset: AssetBalance) {
  return (asset.quantity ?? 0) * (asset.averagePurchasePrice ?? 0);
}
function getInvestmentMarketValue(asset: AssetBalance) {
  return Math.round((asset.quantity ?? 0) * (asset.currentPrice ?? asset.averagePurchasePrice ?? 0));
}
function getInvestmentProfitRate(asset: AssetBalance) {
  const cost = getInvestmentCost(asset);
  return cost > 0 ? ((getInvestmentMarketValue(asset) - cost) / cost) * 100 : 0;
}
function getAssetCurrentBalance(asset: AssetBalance, items: CalendarItem[]) {
  if (asset.kind === "stock" || asset.kind === "crypto") return getInvestmentMarketValue(asset);
  return items.reduce((balance, item) => {
    const transferOut = item.type === "transfer" && item.transferFrom === asset.name;
    const transferIn = item.type === "transfer" && item.transferTo === asset.name;
    const matches = asset.kind === "localCurrency"
      ? item.localCurrencyTarget === asset.name || item.transferTo === asset.name || (item.paymentMethod === "localCurrency" && item.assetName === asset.name)
      : (item.assetName === asset.name && item.assetKind === asset.kind) || transferOut || transferIn;
    if (!matches) return balance;
    if (transferOut) return balance - (item.amount ?? 0);
    if (transferIn) return balance + (item.category === "지역화폐 충전" ? (item.localCurrencyLoadedAmount ?? item.amount ?? 0) : (item.amount ?? 0));
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
function inferMarketTicker(kind: AssetBalance["kind"], name: string, ticker: string) {
  if (ticker.trim()) return ticker.trim().toUpperCase();
  const normalized = name.replace(/\s/g, "").toLowerCase();
  if (kind === "stock") return ({ 삼성전자: "005930.KS", sk하이닉스: "000660.KS", 현대차: "005380.KS", 카카오: "035720.KS", 네이버: "035420.KS", 애플: "AAPL", apple: "AAPL", 테슬라: "TSLA", tesla: "TSLA", 마이크로소프트: "MSFT", microsoft: "MSFT", 엔비디아: "NVDA", nvidia: "NVDA", 아마존: "AMZN", amazon: "AMZN", 구글: "GOOGL", google: "GOOGL", 메타: "META", meta: "META", 코카콜라: "KO", coca: "KO", spy: "SPY", voo: "VOO", qqq: "QQQ", vti: "VTI", schd: "SCHD", dia: "DIA", jepi: "JEPI", tlt: "TLT", gld: "GLD", soxl: "SOXL", tqqq: "TQQQ", s앤피500: "SPY", 나스닥100: "QQQ", 미국배당성장: "SCHD", 미국채권: "TLT" } as Record<string, string>)[normalized];
  if (kind === "crypto") return ({ 비트코인: "BITHUMB:BTC_KRW", btc: "BITHUMB:BTC_KRW", 이더리움: "BITHUMB:ETH_KRW", eth: "BITHUMB:ETH_KRW", 리플: "BITHUMB:XRP_KRW", xrp: "BITHUMB:XRP_KRW", 솔라나: "BITHUMB:SOL_KRW", sol: "BITHUMB:SOL_KRW", 도지코인: "BITHUMB:DOGE_KRW", doge: "BITHUMB:DOGE_KRW", 에이다: "BITHUMB:ADA_KRW", ada: "BITHUMB:ADA_KRW" } as Record<string, string>)[normalized];
  return undefined;
}
function AssetManager({ assets, items, onChange, onClose }: { assets: AssetBalance[]; items: CalendarItem[]; onChange: (value: AssetBalance[]) => void; onClose: () => void }) {
  const [kind, setKind] = useState<AssetBalance["kind"]>("account");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [quantity, setQuantity] = useState("");
  const [averagePurchasePrice, setAveragePurchasePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [ticker, setTicker] = useState("");
  const [owner, setOwner] = useState("나");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const isInvestment = kind === "stock" || kind === "crypto";
  const resetForm = () => { setEditingAssetId(null); setName(""); setBalance(""); setQuantity(""); setAveragePurchasePrice(""); setCurrentPrice(""); setTicker(""); setKind("account"); setOwner("나"); };
  const editAsset = (asset: AssetBalance) => { setEditingAssetId(asset.id); setKind(asset.kind); setName(asset.name); setBalance(String(asset.initialBalance)); setQuantity(asset.quantity ? String(asset.quantity) : ""); setAveragePurchasePrice(asset.averagePurchasePrice ? String(asset.averagePurchasePrice) : ""); setCurrentPrice(asset.currentPrice ? String(asset.currentPrice) : ""); setTicker(asset.ticker ?? ""); setOwner(asset.owner); };
  const transfers = items.filter((item) => item.category === "지역화폐 충전").sort((a, b) => b.date.localeCompare(a.date));
  const addAsset = () => {
    if (!name.trim()) return;
    const next = { id: `asset-${Date.now()}`, kind, name: name.trim(), initialBalance: isInvestment ? 0 : Number(balance.replace(/[^0-9]/g, "")) || 0, owner, quantity: isInvestment ? Number(quantity) || 0 : undefined, averagePurchasePrice: isInvestment ? Number(averagePurchasePrice) || 0 : undefined, currentPrice: isInvestment ? Number(currentPrice || averagePurchasePrice) || 0 : undefined, ticker: isInvestment ? inferMarketTicker(kind, name, ticker) : undefined };
    onChange(editingAssetId ? assets.map((asset) => asset.id === editingAssetId ? { ...asset, ...next, id: asset.id } : asset) : [...assets, next]);
    resetForm();
  };
  const labelForKind = (assetKind: AssetBalance["kind"]) => assetKind === "account" ? "계좌" : assetKind === "cash" ? "현금" : assetKind === "localCurrency" ? "지역화폐" : assetKind === "stock" ? "주식" : "코인";
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="composer-sheet asset-manager-sheet" role="dialog" aria-modal="true" aria-label="자산 잔액 관리"><div className="sheet-handle" /><div className="sheet-header"><div><span className="section-eyebrow">MY ASSETS</span><h2>현재 가진 돈과 투자자산을 관리해요</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><p className="manager-description">계좌·현금·지역화폐와 주식·코인의 보유 수량을 입력해요. 종목코드를 넣으면 현재가를 60초마다 자동으로 갱신해요.</p><div className="asset-manager-form"><div className="manager-tabs">{([["account", "계좌"], ["cash", "현금"], ["localCurrency", "지역화폐"], ["stock", "주식"], ["crypto", "코인"]] as const).map(([value, label]) => <button key={value} type="button" className={kind === value ? "active" : ""} onClick={() => setKind(value)}>{label}</button>)}</div><div className="field-row"><label className="field-label">{kind === "stock" ? "종목명" : kind === "crypto" ? "코인명" : "자산 이름"}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "stock" ? "예: 삼성전자" : kind === "crypto" ? "예: 비트코인" : kind === "account" ? "예: 신한 주거래" : kind === "cash" ? "예: 지갑" : "예: 경기지역화폐"} /></label>{isInvestment && <label className="field-label">시세 코드<input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder={kind === "stock" ? "예: 005930.KS" : "예: BTC-KRW"} /><small className="investment-hint">국내 주식은 .KS/.KQ, 미국 주식·미니스탁 ETF는 AAPL·SPY·QQQ처럼 입력해요. 코인은 빗썸 원화마켓으로 조회해요.</small></label>}{!isInvestment && <label className="field-label">초기 잔액<input inputMode="numeric" value={balance} onChange={(event) => setBalance(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></label>}</div>{isInvestment && <><div className="field-row"><label className="field-label">보유 수량<input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="예: 3.5" /></label><label className="field-label">평균 매수가<input inputMode="decimal" value={averagePurchasePrice} onChange={(event) => setAveragePurchasePrice(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="원화 기준" /></label></div><label className="field-label">현재가<input inputMode="decimal" value={currentPrice} onChange={(event) => setCurrentPrice(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="자동 조회 실패 시 수동 입력" /></label><small className="investment-hint">평가액 = 보유 수량 × 현재가 · 평가손익 = 평가액 − 매수원가 · 종목코드가 있으면 자동 갱신</small></>}<div className="asset-owner-row"><span>소유자</span><div>{["나", "신랑", "공동"].map((value) => <button type="button" className={owner === value ? "selected" : ""} key={value} onClick={() => setOwner(value)}>{value}</button>)}</div></div><button className="save-button asset-add-button" type="button" onClick={addAsset}>{editingAssetId ? "자산 수정 저장" : "자산 추가"} {editingAssetId ? <Check size={16} /> : <Plus size={16} />}</button>{editingAssetId && <button className="asset-cancel-button" type="button" onClick={resetForm}>수정 취소</button>}</div><div className="asset-balance-list">{assets.length ? assets.map((asset) => { const current = getAssetCurrentBalance(asset, items); const assetIsInvestment = asset.kind === "stock" || asset.kind === "crypto"; const cost = assetIsInvestment ? getInvestmentCost(asset) : 0; const profit = current - cost; const profitRate = assetIsInvestment ? getInvestmentProfitRate(asset) : 0; return <div className="asset-balance-row" key={asset.id}><div><strong>{asset.name}</strong><small>{labelForKind(asset.kind)} · {asset.owner}</small>{assetIsInvestment && <small>{asset.quantity ?? 0}개 · 평균 {formatWon(asset.averagePurchasePrice ?? 0)} · {asset.ticker || "시세 코드 없음"}</small>}{assetIsInvestment && asset.priceUpdatedAt && <small className="investment-hint">현재가 {asset.nativePrice && asset.nativeCurrency && asset.nativeCurrency !== "KRW" ? `${asset.nativeCurrency} ${asset.nativePrice.toLocaleString("ko-KR")} → 원화 환산` : asset.priceCurrency ?? "KRW"} · {new Date(asset.priceUpdatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>}</div><div className="asset-balance-values"><b>{formatWon(current)}</b>{assetIsInvestment && <small className={profit >= 0 ? "investment-profit" : "investment-loss"}>{profit >= 0 ? "▲" : "▼"} {formatWon(Math.abs(profit))} ({cost ? `${profitRate >= 0 ? "+" : "−"}${Math.abs(profitRate).toFixed(2)}%` : "수익률 계산 대기"})</small>}<button className="asset-edit-button" type="button" onClick={() => editAsset(asset)} aria-label={`${asset.name} 수정`}><Pencil size={14} /></button><button type="button" onClick={() => { if (window.confirm(`${asset.name} 자산을 삭제할까요?`)) { if (editingAssetId === asset.id) resetForm(); onChange(assets.filter((item) => item.id !== asset.id)); } }} aria-label={`${asset.name} 삭제`}><X size={14} /></button></div></div>; }) : <div className="soft-empty">등록된 자산이 아직 없어요.</div>}</div><section className="asset-transfer-history"><div className="asset-transfer-heading"><div><span className="section-eyebrow">TRANSFER HISTORY</span><strong>계좌 → 지역화폐 이체 내역</strong></div><span>{transfers.length}건</span></div>{transfers.length ? <div className="asset-transfer-list">{transfers.map((item) => <div className="asset-transfer-row" key={item.id}><div><strong>{item.localCurrencySource || item.assetName || "출금 계좌"} <span>→</span> {item.localCurrencyTarget || "지역화폐"}</strong><small>{item.date} · 할인 {item.localCurrencyDiscountRate ?? 0}%</small></div><div><b>{formatWon(item.amount)}</b><small>충전 {formatWon(item.localCurrencyLoadedAmount ?? item.amount)}</small></div></div>)}</div> : <div className="soft-empty">지역화폐 충전 이체 내역이 아직 없어요.</div>}</section><button className="save-button manager-done" type="button" onClick={onClose}>완료 <Check size={17} /></button></section></div>;
}
function CategoryManager({ customCategories, onChange, onClose }: { customCategories: Partial<Record<ItemType, string[]>>; onChange: (value: Partial<Record<ItemType, string[]>>) => void; onClose: () => void }) {
  const [kind, setKind] = useState<"income" | "expense" | "loan" | "savings">("expense");
  const [categoryMode, setCategoryMode] = useState<"single" | "hierarchical">("single");
  const [name, setName] = useState("");
  const [incomeMajor, setIncomeMajor] = useState("");
  const [incomeMiddle, setIncomeMiddle] = useState("");
  const [incomeMinor, setIncomeMinor] = useState("");
  useEffect(() => {
    if (!["income", "expense"].includes(kind)) setCategoryMode("single");
  }, [kind]);
  const add = () => {
    const parts = categoryMode === "hierarchical" ? [incomeMajor, incomeMiddle, incomeMinor].map((value) => value.trim()) : [name.trim()];
    if (parts.some((part) => !part)) return;
    const trimmed = parts.join(" / ");
    if (categories[kind].includes(trimmed) || (customCategories[kind] ?? []).includes(trimmed)) return;
    onChange({ ...customCategories, [kind]: [...(customCategories[kind] ?? []), trimmed] });
    setName("");
    setIncomeMajor("");
    setIncomeMiddle("");
    setIncomeMinor("");
  };
  const remove = (category: string) => onChange({ ...customCategories, [kind]: (customCategories[kind] ?? []).filter((item) => item !== category) });
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="composer-sheet category-manager-sheet" role="dialog" aria-modal="true" aria-label="카테고리 관리"><div className="sheet-handle" /><div className="sheet-header"><div><span className="section-eyebrow">CATEGORY LAB</span><h2>나만의 카테고리</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><p className="manager-description">수입과 지출 모두 단일 분류 또는 대분류·중분류·소분류로 저장할 수 있어요. 직접 만든 분류는 삭제할 수 있으며 입력 화면과 AI 자동 분류에 바로 반영돼요.</p><div className="manager-tabs">{(["expense", "income", "loan", "savings"] as const).map((type) => <button key={type} className={kind === type ? "active" : ""} type="button" onClick={() => setKind(type)}>{typeMeta[type].label}</button>)}</div><div className="category-mode-switch manager-mode-switch"><button type="button" className={categoryMode === "single" ? "selected" : ""} onClick={() => setCategoryMode("single")}>단일 분류</button><button type="button" className={categoryMode === "hierarchical" ? "selected" : ""} onClick={() => setCategoryMode("hierarchical")} disabled={!(["income", "expense"] as const).includes(kind as "income" | "expense")}>대·중·소 분류</button></div><div className="manager-add-row">{categoryMode === "hierarchical" ? <><input value={incomeMajor} onChange={(event) => setIncomeMajor(event.target.value)} placeholder="대분류 예: 생활" /><input value={incomeMiddle} onChange={(event) => setIncomeMiddle(event.target.value)} placeholder="중분류 예: 식비" /><input value={incomeMinor} onChange={(event) => setIncomeMinor(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="소분류 예: 외식" /></> : <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="예: 반려동물" />}<button type="button" onClick={add}><Plus size={16} /> 추가</button></div><div className="manager-category-list">{categories[kind].map((category) => <span className="manager-category built-in" key={category}>{category}</span>)}{(customCategories[kind] ?? []).map((category) => <span className="manager-category custom" key={category}>{category}<button type="button" onClick={() => remove(category)} aria-label={`${category} 삭제`}><X size={12} /></button></span>)}</div><button className="save-button manager-done" type="button" onClick={onClose}>완료 <Check size={17} /></button></section></div>;
}

function EmptyState({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="empty-state" type="button" onClick={onClick}><span><Plus size={15} /></span>{label}</button>;
}

function FamilyShareSheet({
  authenticated, loading, family, familyName, inviteCode, message, conflict, userName, userEmail, onLogout, onLogin, onRegister, onFamilyNameChange, onInviteCodeChange, onCreate, onJoin, onCopy, onResolveConflict, onRestore, onClose,
}: {
  authenticated: boolean;
  loading: boolean;
  family: { id: number; name: string; inviteCode: string; records: unknown[]; version: number; backups: Array<{ id: number; version: number; createdAt: string | Date }>; updatedAt: string } | null;
  familyName: string;
  inviteCode: string;
  message: string | null;
  conflict: { version: number; remoteRecords: CalendarItem[] } | null;
  userName: string;
  userEmail: string;
  onLogout: () => Promise<void>;
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, name: string) => Promise<unknown>;
  onFamilyNameChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onCopy: () => void;
  onResolveConflict: (mode: "local" | "remote" | "merge") => void;
  onRestore: (backupId: number) => void;
  onClose: () => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const submitAuth = async () => {
    setAuthError(null);
    try {
      if (authMode === "register") await onRegister(authEmail, authPassword, authName);
      else await onLogin(authEmail, authPassword);
    } catch (error: any) {
      setAuthError(error?.message?.replace(/^.*?: /, "") || "로그인하지 못했어요. 입력 내용을 확인해 주세요.");
    }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="family-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-topline"><div><span className="section-eyebrow">FAMILY CLOUD</span><h2><Users size={20} /> 가족과 함께 쓰기</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
        {authenticated && <div className="account-card"><div className="account-avatar">{userName.slice(0, 1)}</div><div className="account-copy"><strong>{userName}</strong><small>{userEmail || "Manus 계정으로 로그인됨"}</small><span>이 계정의 일정·가계부·자산으로 이용 중</span></div><button type="button" className="account-logout" onClick={onLogout}>로그아웃</button></div>}
        {!authenticated ? <div className="family-login-card"><Cloud size={27} /><strong>{authMode === "login" ? "내 계정으로 로그인" : "새 계정 만들기"}</strong><p>이메일 계정마다 일정·할 일·가계부·자산 데이터가 따로 저장돼요.</p>{authMode === "register" && <label className="field-label">이름<input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="예: 혜원" autoComplete="name" /></label>}<label className="field-label">이메일<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="example@email.com" autoComplete="email" /></label><label className="field-label">비밀번호<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="8자 이상" autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label><button className="save-button" type="button" onClick={() => void submitAuth()} disabled={loading || !authEmail || !authPassword || (authMode === "register" && !authName.trim())}>{authMode === "login" ? "로그인" : "회원가입"}</button><button className="text-button" type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(null); }}>{authMode === "login" ? "처음이에요 · 회원가입" : "이미 계정이 있어요 · 로그인"}</button>{authError && <div className="family-message" role="alert">{authError}</div>}</div> : family ? <div className="family-connected-card"><div className="family-connected-head"><div><span className="connected-dot" /> 실시간 공유 중</div><small>{family.name}</small></div><div className="family-code-box"><span>가족 초대 코드</span><strong>{family.inviteCode}</strong><button type="button" onClick={onCopy}><Copy size={15} /> 복사</button></div><div className="family-sync-note"><Cloud size={15} /> 최근 동기화 {new Date(family.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 약 5초마다 새 기록을 확인해요</div><p>신랑의 앱에서 이 코드를 입력하면 같은 장부를 함께 볼 수 있어요.</p></div> : <><div className="family-intro"><Cloud size={26} /><div><strong>우리 가족 공간 만들기</strong><p>현재 기기의 기록을 가족과 공유할 수 있는 안전한 공간이에요.</p></div></div><label className="field-label">공간 이름<input value={familyName} onChange={(event) => onFamilyNameChange(event.target.value)} /></label><button className="save-button family-main-button" type="button" onClick={onCreate} disabled={loading}>공유 공간 만들고 초대 코드 받기</button><div className="family-divider"><span>또는</span></div><label className="field-label">가족에게 받은 초대 코드<input value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value.toUpperCase())} placeholder="예: AB12CD" maxLength={12} /></label><button className="outline-button family-main-button" type="button" onClick={onJoin} disabled={loading || inviteCode.length < 4}>초대 코드로 참여하기</button></>}
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
  assets,
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
  assets: AssetBalance[];
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  monthlyCardSpend: Record<string, number>;
  localCurrencyBalances: Record<string, number>;
}) {
  const meta = typeMeta[draft.type];
  const assetsForKind = assets.filter((asset) => asset.kind === draft.assetKind);
  const accountAssets = assets.filter((asset) => ["account", "cash"].includes(asset.kind));
  const localCurrencyAssets = assets.filter((asset) => asset.kind === "localCurrency");
  const currencyTargetAssets = assets.filter((asset) => asset.kind === "localCurrency" || /지역화폐|상품권/.test(asset.name));
  const isFinance = ["income", "expense", "transfer", "loan", "savings"].includes(draft.type);
  const aiSuggestion = isFinance ? aiSuggestCategory(draft.type, `${draft.title} ${draft.note}`, categoryMap) : null;
  const [categoryMode, setCategoryMode] = useState<"single" | "hierarchical">(() => draft.category.includes(" / ") ? "hierarchical" : "single");
  useEffect(() => {
    setCategoryMode(draft.category.includes(" / ") ? "hierarchical" : "single");
  }, [draft.type]);
  const categoryPaths = (["income", "expense"] as ItemType[]).includes(draft.type) ? categoryMap[draft.type] : [];
  const singleCategories = categoryPaths.filter((category) => !category.includes(" / "));
  const hierarchicalCategoryPaths = categoryPaths.filter((category) => category.includes(" / ")).map((category) => { const parts = category.split(" / "); return { category, major: parts[0], middle: parts[1] ?? "기본", minor: parts[2] ?? parts[1] ?? parts[0] }; });
  const selectedCategoryPath = hierarchicalCategoryPaths.find((path) => path.category === draft.category) ?? hierarchicalCategoryPaths[0];
  const categoryMajors = [...new Set(hierarchicalCategoryPaths.map((path) => path.major))];
  const categoryMiddles = [...new Set(hierarchicalCategoryPaths.filter((path) => path.major === selectedCategoryPath?.major).map((path) => path.middle))];
  const categoryMinors = hierarchicalCategoryPaths.filter((path) => path.major === selectedCategoryPath?.major && path.middle === selectedCategoryPath?.middle);
  const selectCategoryLevel = (level: "major" | "middle" | "minor", value: string) => {
    const candidates = hierarchicalCategoryPaths.filter((path) => level === "major" ? path.major === value : level === "middle" ? path.major === selectedCategoryPath?.major && path.middle === value : path.major === selectedCategoryPath?.major && path.middle === selectedCategoryPath?.middle && path.minor === value);
    if (candidates[0]) update({ category: candidates[0].category });
  };
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
    const shouldAutoClassify = isFinance && categoryMode === "single" && typeof patch.title === "string" && patch.title.trim().length >= 2;
    onChange(shouldAutoClassify ? { ...next, category: aiSuggestCategory(draft.type, `${next.title} ${next.note}`, categoryMap).category } : next);
  };
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="composer-sheet" role="dialog" aria-modal="true" aria-label={editing ? "기록 수정" : "새 기록"}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="section-eyebrow">{editing ? "EDIT RECORD" : "QUICK RECORD"}</span><h2>{editing ? "기록을 다듬어요" : "무엇을 기록할까요?"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
        <div className="transaction-mode-strip"><span>금융 기록</span><div>{(["income", "expense", "transfer"] as ItemType[]).map((type) => { const TypeIcon = typeMeta[type].icon; return <button className={draft.type === type ? `active ${type}` : ""} type="button" key={type} onClick={() => update({ type, category: categoryMap[type][0], assetKind: type === "expense" ? "card" : "account" })}><TypeIcon size={14} />{type === "income" ? "수입" : type === "expense" ? "지출" : "이체"}</button>; })}<button className={draft.type === "transfer" && draft.category === "지역화폐 충전" ? "active transfer" : ""} type="button" onClick={() => update({ type: "transfer", category: "지역화폐 충전", assetKind: "account" })}>지역화폐 충전</button></div></div><div className="composer-flow-hint">기본정보 <span>›</span> 분류 <span>›</span> 자산·계좌 <span>›</span> 저장</div><div className="type-tabs">{(Object.keys(typeMeta) as ItemType[]).filter((type) => !["income", "expense", "transfer"].includes(type)).map((type) => { const TypeIcon = typeMeta[type].icon; return <button className={draft.type === type ? "active" : ""} type="button" key={type} onClick={() => update({ type, category: categoryMap[type][0], time: type === "event" ? draft.time || "12:00" : "", assetKind: type === "loan" ? "loan" : type === "savings" ? "savings" : draft.assetKind, accentColor: type === "todo" ? "#716a65" : type === "event" ? "#c96f64" : "" })}><TypeIcon size={15} />{typeMeta[type].label}</button>; })}</div>
        <div className="composer-form">
          <label className="field-label">{isFinance ? "무엇에 대한 기록인가요?" : draft.type === "event" ? "일정 이름" : "할 일"}<input autoFocus value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder={draft.type === "todo" ? "예: 장보기" : draft.type === "event" ? "예: 저녁 약속" : "예: 점심 식사"} /></label>
          <div className="field-row"><label className="field-label">시작일<input type="date" value={draft.date} onChange={(event) => { const date = event.target.value; const lunar = getLunarMonthDay(fromISO(date)); update({ date, ...(draft.type === "event" && draft.endDate < date ? { endDate: date } : {}), ...(draft.calendarKind === "lunar" ? { lunarMonth: lunar.month, lunarDay: lunar.day, lunarLeapMonth: lunar.lunarLeapMonth } : {}) }); }} /></label>{draft.type === "event" && <label className="field-label">종료일<input type="date" value={draft.endDate || draft.date} min={draft.date} onChange={(event) => update({ endDate: event.target.value })} /></label>}{["todo", "event"].includes(draft.type) && <label className="field-label">달력 기준<select value={draft.calendarKind} onChange={(event) => { const calendarKind = event.target.value as Draft["calendarKind"]; const lunar = getLunarMonthDay(fromISO(draft.date)); update({ calendarKind, ...(calendarKind === "lunar" ? { lunarMonth: lunar.month, lunarDay: lunar.day, lunarLeapMonth: lunar.lunarLeapMonth, recurrence: draft.recurrence === "none" ? "yearly" : draft.recurrence, repeatUntil: "" } : {}) }); }}><option value="solar">양력</option><option value="lunar">음력</option></select></label>}{draft.type === "event" && <label className="field-label">시간<input type="time" value={draft.time} onChange={(event) => update({ time: event.target.value })} /></label>}{isFinance && <label className="field-label">금액<input inputMode="numeric" value={draft.amount} onChange={(event) => update({ amount: event.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></label>} </div>{draft.type === "income" && <label className="toggle-field expected-income-toggle"><span>예상 수입으로 표시</span><input type="checkbox" checked={draft.expectedIncome} onChange={(event) => update({ expectedIncome: event.target.checked })} /></label>}{draft.type === "expense" && <label className="toggle-field expected-expense-toggle"><span>예상 지출로 표시</span><input type="checkbox" checked={draft.expectedExpense} onChange={(event) => update({ expectedExpense: event.target.checked })} /></label>}
          <div className="field-label">분류{(["income", "expense"] as ItemType[]).includes(draft.type) ? <><div className="category-mode-switch"><button type="button" className={categoryMode === "single" ? "selected" : ""} onClick={() => { setCategoryMode("single"); update({ category: singleCategories[0] ?? categoryMap[draft.type][0] }); }}>단일 분류</button><button type="button" className={categoryMode === "hierarchical" ? "selected" : ""} onClick={() => { setCategoryMode("hierarchical"); if (hierarchicalCategoryPaths[0]) update({ category: hierarchicalCategoryPaths[0].category }); }} disabled={!hierarchicalCategoryPaths.length}>대·중·소 분류</button></div>{categoryMode === "hierarchical" && hierarchicalCategoryPaths.length ? <div className="category-hierarchy"><label>대분류<select value={selectedCategoryPath?.major ?? ""} onChange={(event) => selectCategoryLevel("major", event.target.value)}>{categoryMajors.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label>중분류<select value={selectedCategoryPath?.middle ?? ""} onChange={(event) => selectCategoryLevel("middle", event.target.value)}>{categoryMiddles.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label>소분류<select value={selectedCategoryPath?.minor ?? ""} onChange={(event) => selectCategoryLevel("minor", event.target.value)}>{categoryMinors.map((path) => <option value={path.minor} key={path.category}>{path.minor}</option>)}</select></label></div> : <div className="category-pills">{singleCategories.map((category) => <button className={draft.category === category ? "selected" : ""} type="button" key={category} onClick={() => update({ category })}>{category}</button>)}{categoryMode === "hierarchical" && !hierarchicalCategoryPaths.length && <span className="field-hint">설정에서 대·중·소 분류를 먼저 추가해 주세요.</span>}</div>}</> : <div className="category-pills">{categoryMap[draft.type].map((category) => <button className={draft.category === category ? "selected" : ""} type="button" key={category} onClick={() => update({ category })}>{category}</button>)}</div>}{aiSuggestion && <div className="ai-suggestion"><Sparkles size={13} /><span><strong>AI 자동 분류</strong> {aiSuggestion.reason}</span><b>{aiSuggestion.confidence}%</b></div>}</div>
          {draft.type === "transfer" && draft.category !== "지역화폐 충전" && <div className="detail-block transfer-block"><div className="detail-block-title">계좌·자산 간 이체</div><div className="field-row"><label className="field-label">출발 자산<select value={draft.transferFrom} onChange={(event) => update({ transferFrom: event.target.value })}><option value="">자산을 선택하세요</option>{assets.map((asset) => <option value={asset.name} key={`from-${asset.id}`}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : asset.kind === "cash" ? "현금" : "계좌"}</option>)}</select></label><label className="field-label">도착 자산<select value={draft.transferTo} onChange={(event) => update({ transferTo: event.target.value })}><option value="">자산을 선택하세요</option>{assets.map((asset) => <option value={asset.name} key={`to-${asset.id}`}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : asset.kind === "cash" ? "현금" : "계좌"}</option>)}</select></label></div><span className="field-hint">수입·지출로 중복 집계하지 않고, 두 자산 사이의 이동으로만 기록해요.</span></div>}{(["income", "expense", "loan", "savings"] as ItemType[]).includes(draft.type) && <div className="asset-owner-row"><span>자산 소유자</span><div>{["나", "신랑", "공동"].map((owner) => <button className={draft.owner === owner ? "selected" : ""} type="button" key={owner} onClick={() => update({ owner })}>{owner}</button>)}</div></div>}
          {isFinance && (draft.type !== "transfer" || draft.category === "지역화폐 충전") && <div className="detail-block asset-block"><div className="detail-block-title"><WalletCards size={15} /> 어떤 자산으로 기록할까요?</div><div className="field-row"><label className="field-label">자산 종류<select value={draft.assetKind} onChange={(event) => update({ assetKind: event.target.value as Draft["assetKind"] })}>{ASSET_KINDS.map((asset) => <option value={asset.value} key={asset.value}>{asset.label}</option>)}</select></label><label className="field-label">자산·계좌<select value={draft.assetName} onChange={(event) => update({ assetName: event.target.value })}><option value="">자산을 선택하세요</option>{draft.assetName && !assetsForKind.some((asset) => asset.name === draft.assetName) && <option value={draft.assetName}>{draft.assetName} · 기존 기록</option>}{(draft.assetKind === "card" ? CARD_COMPANIES.map((name) => ({ id: `card-${name}`, name, kind: "card" })) : assetsForKind).map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : asset.kind === "cash" ? "현금" : asset.kind === "card" ? "카드" : "계좌"}</option>)}</select>{assetsForKind.length === 0 && draft.assetKind !== "card" && <span className="field-hint">자산 관리에서 계좌·현금·지역화폐를 먼저 등록해 주세요.</span>}</label></div>{draft.type === "expense" && draft.category !== "지역화폐 충전" && <label className="field-label">결제수단<select value={draft.paymentMethod} onChange={(event) => update({ paymentMethod: event.target.value as Draft["paymentMethod"] })}>{PAYMENT_METHODS.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}</select></label>}{draft.type === "expense" && draft.category === "지역화폐 충전" && <div className="detail-block local-currency-block"><div className="detail-block-title">지역화폐 충전 설정</div><div className="field-row"><label className="field-label">출발 계좌<select value={draft.localCurrencySource} onChange={(event) => update({ localCurrencySource: event.target.value, assetKind: "account", assetName: event.target.value, paymentMethod: "account" })}><option value="">계좌를 선택하세요</option>{accountAssets.map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "cash" ? "현금" : "계좌"}</option>)}</select></label><label className="field-label">지역화폐 계좌<select value={draft.localCurrencyTarget} onChange={(event) => update({ localCurrencyTarget: event.target.value })}><option value="">지역화폐 계좌를 선택하세요</option>{currencyTargetAssets.map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : "상품권"}</option>)}</select></label></div><label className="field-label">충전 할인율(%)<input inputMode="decimal" value={draft.localCurrencyDiscountRate} onChange={(event) => update({ localCurrencyDiscountRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 10" /></label>{draft.amount && <div className="local-currency-estimate">계좌에서 {formatWon(Number(draft.amount))} 차감 · {formatWon(Math.round(Number(draft.amount) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)))} 충전 · 할인 {formatWon(Math.max(0, Math.round(Number(draft.amount) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)) - Number(draft.amount)))}</div>}</div>}{draft.type === "transfer" && draft.category === "지역화폐 충전" && <div className="detail-block local-currency-block"><div className="detail-block-title">지역화폐 충전 설정</div><div className="field-row"><label className="field-label">출발 계좌<select value={draft.localCurrencySource} onChange={(event) => update({ localCurrencySource: event.target.value, assetKind: "account", assetName: event.target.value, paymentMethod: "account" })}><option value="">계좌를 선택하세요</option>{accountAssets.map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "cash" ? "현금" : "계좌"}</option>)}</select></label><label className="field-label">지역화폐 계좌<select value={draft.localCurrencyTarget} onChange={(event) => update({ localCurrencyTarget: event.target.value })}><option value="">지역화폐 계좌를 선택하세요</option>{currencyTargetAssets.map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : "상품권"}</option>)}</select></label></div><label className="field-label">충전 할인율(%)<input inputMode="decimal" value={draft.localCurrencyDiscountRate} onChange={(event) => update({ localCurrencyDiscountRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 10" /></label>{draft.amount && <div className="local-currency-estimate">계좌에서 {formatWon(Number(draft.amount))} 차감 · {formatWon(Math.round(Number(draft.amount) / Math.max(0.01, 1 - Number(draft.localCurrencyDiscountRate || 0) / 100)))} 충전</div>}</div>}{draft.type === "expense" && draft.paymentMethod === "localCurrency" && <div className="detail-block local-currency-use-block"><div className="detail-block-title">지역화폐로 결제</div><label className="field-label">사용할 지역화폐 계좌<select value={draft.localCurrencyTarget} onChange={(event) => update({ localCurrencyTarget: event.target.value, assetKind: "localCurrency", assetName: event.target.value })}><option value="">지역화폐 계좌를 선택하세요</option>{currencyTargetAssets.map((asset) => <option value={asset.name} key={asset.id}>{asset.name} · {asset.kind === "localCurrency" ? "지역화폐" : "상품권"}</option>)}</select></label><label className="field-label">캐시백률(%)<input inputMode="decimal" value={draft.localCurrencyCashbackRate} onChange={(event) => update({ localCurrencyCashbackRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 5" /></label><div className="local-currency-cashback-preview">이번 결제 예상 캐시백 {formatWon(Math.round(Number(draft.amount || 0) * Number(draft.localCurrencyCashbackRate || 0) / 100))} · 결제 후 잔액에 자동 재적립</div><div className={`local-currency-balance ${localCurrencyBalance < Number(draft.amount || 0) ? "insufficient" : ""}`}><span>{localCurrencyName} 현재 잔액</span><strong>{formatWon(localCurrencyBalance)}</strong>{draft.amount && localCurrencyBalance < Number(draft.amount) && <small>잔액이 {formatWon(Number(draft.amount) - localCurrencyBalance)} 부족해요.</small>}</div></div>}{draft.type === "expense" && draft.paymentMethod === "card" && <><label className="field-label">결제 카드<select value={draft.cardCompany} onChange={(event) => update({ cardCompany: event.target.value, assetKind: "card", assetName: event.target.value })}>{CARD_COMPANIES.map((company) => <option key={company}>{company}</option>)}</select></label><div className="card-benefit-panel"><div className="card-benefit-head"><span><CreditCard size={14} /> {draft.cardCompany} 이번 달 실적</span><strong className={cardBenefitReady ? "ready" : "pending"}>{cardBenefitReady ? "혜택 조건 충족" : `${formatWon(Math.max(0, cardBenefit.threshold - previewCardSpend))} 부족`}</strong></div><div className="card-benefit-progress"><i style={{ width: `${cardSpendProgress}%` }} /></div><div className="card-benefit-meta"><span>{formatWon(previewCardSpend)} / {formatWon(cardBenefit.threshold)}</span><span>예상 할인 한도 {formatWon(cardBenefit.cap)}</span></div><small>{categoryBenefitReady ? "현재 카테고리는 할인 대상에 포함된 것으로 설정되어 있어요." : "현재 카테고리는 등록된 참고 혜택 대상과 다를 수 있어요."} 카드 상품별 실제 조건은 카드사 약관을 확인해 주세요.</small></div></>}</div>}
          {(["todo", "event"] as ItemType[]).includes(draft.type) && <div className="asset-owner-row"><span>{draft.type === "todo" ? "할 일" : "일정"} 색상</span><div className="color-choice">{["#6f63b6", "#e98272", "#4c9d83", "#5ca9d6", "#e2b34f", "#d26aa2", "#e05b78", "#7d5ab6", "#2f8f9d", "#d17b32", "#4f6fae", "#8c6b52", "#d94f70", "#f08a5d", "#f2c14e", "#75b798", "#45a7c7", "#9b8af2", "#c56b98", "#6b7280", "#374151", "#a85d3a", "#b7c94b", "#ef6f9f"].map((color) => <button className={draft.accentColor === color ? "selected" : ""} style={{ backgroundColor: color }} type="button" key={color} onClick={() => update({ accentColor: color })} aria-label={`${color} 색상`} />)}</div></div>}
          {(["todo", "event", "expense", "loan"] as ItemType[]).includes(draft.type) && <div className="detail-block recurring-block"><div className="detail-block-title">{["expense", "loan"].includes(draft.type) ? "자동이체·결제 반복 설정" : "반복 일정 설정"}</div><label className="field-label">반복 주기<select value={draft.recurrence} onChange={(event) => { const recurrence = event.target.value as Draft["recurrence"]; update({ recurrence, repeatUntil: "" }); }}><option value="none">한 번만</option><option value="daily">매일 반복</option><option value="weekly">매주 반복</option><option value="monthly">매월 반복</option><option value="yearly">매년 반복</option></select></label>{draft.recurrence !== "none" && <><label className="field-label">반복 종료<select value={draft.repeatUntil ? "date" : "none"} onChange={(event) => { const endMode = event.target.value; update({ repeatUntil: endMode === "none" ? "" : draft.repeatUntil || toISO(addYears(fromISO(draft.date), 5)) }); }}><option value="none">없음</option><option value="date">날짜 지정</option></select></label>{draft.repeatUntil && <label className="field-label">반복 종료일<input type="date" value={draft.repeatUntil} min={draft.date} onChange={(event) => update({ repeatUntil: event.target.value })} /></label>}</>}<span className="field-hint">일정·할 일은 매일, 매주, 매월, 매년 반복할 수 있어요. 종료일이 없으면 계속 표시되고, 음력 일정은 매년 음력 날짜에 맞춰 표시해요.</span></div>}
          {(["expense", "loan"] as ItemType[]).includes(draft.type) && <div className="detail-block payment-schedule-block"><div className="detail-block-title">{draft.type === "loan" ? "상환일·자동이체" : "결제 예정일·자동이체"}</div><div className="field-row"><label className="field-label">{draft.type === "loan" ? "상환 예정일" : "결제 예정일"}<input type="date" value={draft.dueDate} onChange={(event) => update({ dueDate: event.target.value })} /></label><label className="toggle-field"><span>자동이체</span><input type="checkbox" checked={draft.autopay} onChange={(event) => update({ autopay: event.target.checked })} /></label></div>{draft.autopay && <label className="field-label">자동이체 계좌<span className="optional">선택</span><select value={draft.autopayAccount} onChange={(event) => update({ autopayAccount: event.target.value })}><option value="">계좌를 선택하세요</option>{accountAssets.map((asset) => <option value={asset.name} key={`autopay-${asset.id}`}>{asset.name} · {asset.kind === "cash" ? "현금" : "계좌"}</option>)}</select></label>}<span className="field-hint">예정일에 맞춰 달력과 현금흐름 리포트에 표시해요.</span>{draft.dueDate && <label className="field-label payment-status-field">처리 상태<select value={draft.paymentStatus} onChange={(event) => update({ paymentStatus: event.target.value as Draft["paymentStatus"] })}><option value="scheduled">예정</option><option value="paid">완료</option><option value="missed">미납</option></select></label>}</div>}{draft.type === "loan" && draft.category === "대출" && <div className="detail-block"><div className="detail-block-title">대출 상세 설정</div><div className="field-row"><label className="field-label">대출 원금<input inputMode="numeric" value={draft.loanPrincipal} onChange={(event) => update({ loanPrincipal: event.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></label><label className="field-label">연 이자율(%)<input inputMode="decimal" value={draft.interestRate} onChange={(event) => update({ interestRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 4.5" /></label></div><div className="field-row"><label className="field-label">거치기간(개월)<input inputMode="numeric" value={draft.gracePeriod} onChange={(event) => update({ gracePeriod: event.target.value.replace(/[^0-9]/g, "") })} /></label><label className="field-label">첫 상환일<input type="date" value={draft.repaymentDate} onChange={(event) => update({ repaymentDate: event.target.value })} /></label></div><div className="field-row"><label className="field-label">상환방식<select value={draft.repaymentMethod} onChange={(event) => update({ repaymentMethod: event.target.value as Draft["repaymentMethod"] })}><option value="equalPayment">원리금균등</option><option value="equalPrincipal">원금균등</option></select></label><label className="field-label">상환기간(개월)<input inputMode="numeric" value={draft.termMonths} onChange={(event) => update({ termMonths: event.target.value.replace(/[^0-9]/g, "") })} /></label></div>{draft.loanPrincipal && draft.interestRate && draft.termMonths && <div className="schedule-preview"><strong>{draft.repaymentMethod === "equalPayment" ? "원리금균등" : "원금균등"} · 총 {Number(draft.termMonths) + Number(draft.gracePeriod || 0)}회</strong><span>거치기간은 이자만 납부하고, 이후 월별 상환일을 달력에 자동 표시해요.</span></div>}</div>}
          {draft.type === "loan" && draft.category === "카드값" && <div className="detail-block"><div className="detail-block-title">카드 결제 상세</div><div className="field-row"><label className="field-label">카드사<select value={draft.cardCompany} onChange={(event) => update({ cardCompany: event.target.value })}>{CARD_COMPANIES.map((company) => <option key={company}>{company}</option>)}</select></label><label className="field-label">결제 방식<select value={draft.cardMode} onChange={(event) => update({ cardMode: event.target.value as Draft["cardMode"] })}><option value="lumpSum">일시불</option><option value="installment">할부</option></select></label></div><div className="field-row"><label className="field-label">수수료율(%)<input inputMode="decimal" value={draft.cardFeeRate} onChange={(event) => update({ cardFeeRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="카드사 안내 수수료" /></label>{draft.cardMode === "installment" && <label className="field-label">할부 개월<input inputMode="numeric" value={draft.installments} onChange={(event) => update({ installments: event.target.value.replace(/[^0-9]/g, "") })} /></label>}</div>{draft.cardMode === "installment" && <div className={`rate-source ${officialCardRate !== undefined ? "verified" : "manual"}`}>{officialCardRate !== undefined ? `공식 기준 자동 적용 · 연 ${officialCardRate}%` : getCardRateBasis(draft.cardCompany, cardInstallments)}</div>}<div className="detail-estimate">예상 총 결제액 {formatWon(cardTotal)} · {draft.cardMode === "installment" ? `월 ${formatWon(cardMonthly)}` : "일시불 결제"}</div></div>}
          {draft.type === "savings" && <div className="detail-block savings-block"><div className="detail-block-title">적금 상세 설정</div><div className="field-row"><label className="field-label">연 이자율(%)<input inputMode="decimal" value={draft.savingsInterestRate} onChange={(event) => update({ savingsInterestRate: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="예: 3.5" /></label><label className="field-label">납입 기간(개월)<input inputMode="numeric" value={draft.savingsTermMonths} onChange={(event) => update({ savingsTermMonths: event.target.value.replace(/[^0-9]/g, "") })} placeholder="12" /></label></div><label className="field-label">만기일<input type="date" value={draft.savingsMaturityDate} onChange={(event) => update({ savingsMaturityDate: event.target.value })} /></label>{draft.amount && draft.savingsTermMonths && <div className="detail-estimate">예상 원금 {formatWon(Number(draft.amount) * Number(draft.savingsTermMonths))} · 월 {formatWon(Number(draft.amount))} 납입</div>}</div>}
          <label className="field-label">메모 <span className="optional">선택</span><textarea value={draft.note} onChange={(event) => update({ note: event.target.value })} placeholder="잊지 않을 한마디를 남겨보세요" rows={2} /></label>
        </div>
        <div className="sheet-actions"><button className="save-button" type="button" style={{ backgroundColor: meta.color }} onClick={onSave}>{editing ? "수정 저장" : "기록 저장"}<Check size={17} /></button>{editing && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}</div>
      </section>
    </div>
  );
}
