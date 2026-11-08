import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Landmark,
  LayoutGrid,
  ListChecks,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  Repeat2,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { syncNativeWidget } from "@/lib/widget";

type ItemType = "todo" | "event" | "income" | "expense" | "loan";
type View = "home" | "calendar" | "ledger";

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
};

type Draft = {
  type: ItemType;
  title: string;
  date: string;
  time: string;
  amount: string;
  category: string;
  note: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "daldal-calendar-items";

const typeMeta: Record<ItemType, { label: string; color: string; soft: string; icon: LucideIcon }> = {
  todo: { label: "할 일", color: "#6f63b6", soft: "#f0edff", icon: ClipboardCheck },
  event: { label: "일정", color: "#e98272", soft: "#fff0ed", icon: CalendarDays },
  income: { label: "수입", color: "#4c9d83", soft: "#e8f7f0", icon: ArrowUpRight },
  expense: { label: "지출", color: "#d87568", soft: "#fff0ed", icon: ArrowDownRight },
  loan: { label: "대출", color: "#b8894d", soft: "#fff6e5", icon: Landmark },
};

const categories: Record<ItemType, string[]> = {
  todo: ["개인", "업무", "집안일", "쇼핑"],
  event: ["약속", "업무", "건강", "가족"],
  income: ["급여", "용돈", "부수입", "환급"],
  expense: ["식비", "교통", "쇼핑", "구독", "생활"],
  loan: ["대출", "카드값", "할부", "저축"],
};

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

function createDraft(date: string, type: ItemType = "todo"): Draft {
  return {
    type,
    title: "",
    date,
    time: type === "event" ? "12:00" : "",
    amount: "",
    category: categories[type][0],
    note: "",
  };
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
          {meta.label}{item.category ? ` · ${item.category}` : ""}{item.time ? ` · ${item.time}` : ""}
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
  const [view, setView] = useState<View>("home");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [items, setItems] = useState<CalendarItem[]>(() => seedItems(today));
  const [isLoaded, setIsLoaded] = useState(false);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => createDraft(todayISO));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
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
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const monthItems = useMemo(() => getMonthItems(items, month), [items, month]);
  const selectedItems = useMemo(() => items.filter((item) => item.date === selectedDate), [items, selectedDate]);
  const todayItems = useMemo(() => items.filter((item) => item.date === todayISO), [items, todayISO]);
  const monthSummary = useMemo(() => {
    const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const loan = monthItems.filter((item) => item.type === "loan").reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return { income, expense, loan, balance: income - expense - loan };
  }, [monthItems]);

  const todayTodos = todayItems.filter((item) => item.type === "todo");
  const todayEvents = todayItems.filter((item) => item.type === "event");
  const nextItems = items
    .filter((item) => item.date > todayISO && (item.type === "event" || item.type === "todo"))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  useEffect(() => {
    void syncNativeWidget({
      todoCount: todayTodos.filter((item) => !item.completed).length,
      eventCount: todayEvents.length,
      balance: monthSummary.balance,
      dateLabel: formatLongDate(todayISO),
    });
  }, [todayISO, todayTodos, todayEvents, monthSummary.balance]);

  const openCreate = (type: ItemType = "todo", date = selectedDate) => {
    setEditingId(null);
    setDraft(createDraft(date, type));
    setComposerOpen(true);
  };

  const openEdit = (item: CalendarItem) => {
    setEditingId(item.id);
    setDraft({
      type: item.type,
      title: item.title,
      date: item.date,
      time: item.time ?? "",
      amount: item.amount ? String(item.amount) : "",
      category: item.category ?? categories[item.type][0],
      note: item.note ?? "",
    });
    setComposerOpen(true);
  };

  const saveItem = () => {
    if (!draft.title.trim()) return;
    const nextItem: CalendarItem = {
      id: editingId ?? `item-${Date.now()}`,
      type: draft.type,
      title: draft.title.trim(),
      date: draft.date,
      time: draft.type === "event" ? draft.time : undefined,
      amount: ["income", "expense", "loan"].includes(draft.type) && draft.amount ? Number(draft.amount.replace(/,/g, "")) : undefined,
      category: draft.category,
      note: draft.note.trim() || undefined,
      completed: editingId ? items.find((item) => item.id === editingId)?.completed : false,
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
          />
        )}
      </main>

      <button className="record-button" type="button" onClick={() => openCreate("todo")}>
        <Plus size={20} strokeWidth={2.8} />
        <span>기록하기</span>
      </button>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={view === "home" ? "active" : ""} type="button" onClick={() => setViewAndScroll("home")}><LayoutGrid size={19} /><span>오늘</span></button>
        <button className={view === "calendar" ? "active" : ""} type="button" onClick={() => setViewAndScroll("calendar")}><CalendarDays size={19} /><span>달력</span></button>
        <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => setViewAndScroll("ledger")}><Wallet size={19} /><span>가계부</span></button>
        <button type="button" onClick={() => openCreate("event")}><Menu size={19} /><span>더보기</span></button>
      </nav>

      {isComposerOpen && (
        <Composer
          draft={draft}
          editing={Boolean(editingId)}
          onChange={setDraft}
          onClose={() => setComposerOpen(false)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
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
}) {
  const cells = getCalendarCells(month);
  return (
    <div className="view-stack calendar-view">
      <div className="page-title-row"><div><span className="section-eyebrow">MONTHLY PLANNER</span><h2>한 달을 한눈에</h2></div><button className="round-action" type="button" onClick={() => onCreate("event", selectedDate)}><Plus size={18} /></button></div>
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
            return (
              <button className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`} key={iso} type="button" onClick={() => onSelectDate(iso)}>
                <span className="calendar-day-number">{date.getDate()}</span>
                <span className="calendar-dots">{dayItems.slice(0, 4).map((item) => <i key={item.id} style={{ backgroundColor: typeMeta[item.type].color }} />)}</span>
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
}: {
  month: Date;
  monthItems: CalendarItem[];
  summary: { income: number; expense: number; loan: number; balance: number };
  onMonthChange: (offset: number) => void;
  onEdit: (item: CalendarItem) => void;
  onCreate: (type?: ItemType, date?: string) => void;
}) {
  const financeItems = monthItems.filter((item) => ["income", "expense", "loan"].includes(item.type)).sort((a, b) => b.date.localeCompare(a.date));
  const grouped = financeItems.reduce<Record<string, CalendarItem[]>>((groups, item) => {
    groups[item.date] = [...(groups[item.date] ?? []), item];
    return groups;
  }, {});
  return (
    <div className="view-stack ledger-view">
      <div className="page-title-row"><div><span className="section-eyebrow">MY LEDGER</span><h2>돈의 흐름도 차곡차곡</h2></div><button className="round-action" type="button" onClick={() => onCreate("expense", toISO(new Date()))}><Plus size={18} /></button></div>
      <div className="month-switcher"><button className="month-arrow" type="button" onClick={() => onMonthChange(-1)}><ChevronLeft size={18} /></button><strong>{monthLabel(month)}</strong><button className="month-arrow" type="button" onClick={() => onMonthChange(1)}><ChevronRight size={18} /></button></div>
      <section className="ledger-hero surface-card"><span className="section-eyebrow">MONTHLY BALANCE</span><strong>{formatWon(summary.balance)}</strong><p>이번 달에 남은 금액이에요</p><div className="ledger-hero-bottom"><span><ArrowUpRight size={15} /> 수입 {formatWon(summary.income)}</span><span><ArrowDownRight size={15} /> 지출·대출 {formatWon(summary.expense + summary.loan)}</span></div></section>
      <section className="ledger-stat-grid"><LedgerStat icon={ArrowUpRight} label="수입" amount={summary.income} tone="income" /><LedgerStat icon={ArrowDownRight} label="지출" amount={summary.expense} tone="expense" /><LedgerStat icon={Landmark} label="대출" amount={summary.loan} tone="loan" /></section>
      <section className="ledger-list-section"><SectionHeading eyebrow="TRANSACTIONS" title="이번 달 기록" action={<button className="text-button" type="button" onClick={() => onCreate("expense", toISO(new Date()))}>빠른 입력 <Plus size={15} /></button>} /><div className="ledger-groups">{Object.keys(grouped).length ? Object.entries(grouped).map(([date, entries]) => <div className="ledger-group" key={date}><div className="ledger-date"><strong>{fromISO(date).getDate()}</strong><span>{fromISO(date).toLocaleDateString("ko-KR", { weekday: "short" })}</span></div><div className="ledger-entries">{entries.map((item) => <button className="ledger-entry" type="button" key={item.id} onClick={() => onEdit(item)}><span className="item-icon" style={{ backgroundColor: typeMeta[item.type].soft, color: typeMeta[item.type].color }}>{(() => { const Icon = typeMeta[item.type].icon; return <Icon size={16} />; })()}</span><span><strong>{item.title}</strong><small>{item.category}</small></span><b className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : "−"}{formatWon(item.amount)}</b><ChevronRight size={15} /></button>)}</div></div>) : <div className="soft-empty">이번 달 금융 기록이 아직 없어요.</div>}</div></section>
    </div>
  );
}

function LedgerStat({ icon: Icon, label, amount, tone }: { icon: LucideIcon; label: string; amount: number; tone: "income" | "expense" | "loan" }) {
  return <div className={`ledger-stat ${tone}`}><span className="stat-icon"><Icon size={16} /></span><span>{label}</span><strong>{formatCompact(amount)}<small>원</small></strong></div>;
}

function EmptyState({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="empty-state" type="button" onClick={onClick}><span><Plus size={15} /></span>{label}</button>;
}

function Composer({
  draft,
  editing,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft;
  editing: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const meta = typeMeta[draft.type];
  const isFinance = ["income", "expense", "loan"].includes(draft.type);
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="composer-sheet" role="dialog" aria-modal="true" aria-label={editing ? "기록 수정" : "새 기록"}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="section-eyebrow">{editing ? "EDIT RECORD" : "QUICK RECORD"}</span><h2>{editing ? "기록을 다듬어요" : "무엇을 기록할까요?"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
        <div className="type-tabs">{(Object.keys(typeMeta) as ItemType[]).map((type) => { const TypeIcon = typeMeta[type].icon; return <button className={draft.type === type ? "active" : ""} type="button" key={type} onClick={() => update({ type, category: categories[type][0], time: type === "event" ? draft.time || "12:00" : "" })}><TypeIcon size={15} />{typeMeta[type].label}</button>; })}</div>
        <div className="composer-form">
          <label className="field-label">{isFinance ? "무엇에 대한 기록인가요?" : draft.type === "event" ? "일정 이름" : "할 일"}<input autoFocus value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder={draft.type === "todo" ? "예: 장보기" : draft.type === "event" ? "예: 저녁 약속" : "예: 점심 식사"} /></label>
          <div className="field-row"><label className="field-label">날짜<input type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} /></label>{draft.type === "event" && <label className="field-label">시간<input type="time" value={draft.time} onChange={(event) => update({ time: event.target.value })} /></label>}{isFinance && <label className="field-label">금액<input inputMode="numeric" value={draft.amount} onChange={(event) => update({ amount: event.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></label>}</div>
          <div className="field-label">분류<div className="category-pills">{categories[draft.type].map((category) => <button className={draft.category === category ? "selected" : ""} type="button" key={category} onClick={() => update({ category })}>{category}</button>)}</div></div>
          <label className="field-label">메모 <span className="optional">선택</span><textarea value={draft.note} onChange={(event) => update({ note: event.target.value })} placeholder="잊지 않을 한마디를 남겨보세요" rows={2} /></label>
        </div>
        <div className="sheet-actions"><button className="save-button" type="button" style={{ backgroundColor: meta.color }} onClick={onSave}>{editing ? "수정 저장" : "기록 저장"}<Check size={17} /></button>{editing && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}</div>
      </section>
    </div>
  );
}
