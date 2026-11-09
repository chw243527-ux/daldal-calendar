import { Capacitor, registerPlugin } from "@capacitor/core";

export type WallpaperItem = {
  type: "todo" | "event" | "income" | "expense" | "transfer" | "loan" | "savings";
  title: string;
  date: string;
  time?: string;
  amount?: number;
  category?: string;
  completed?: boolean;
};

type WallpaperOptions = {
  month: Date;
  items: WallpaperItem[];
  balance: number;
  income: number;
  expense: number;
  loan: number;
};

type WallpaperPlugin = {
  openLiveWallpaperSettings(): Promise<void>;
  setLockScreenWallpaper(options: { image: string }): Promise<void>;
};

const Wallpaper = registerPlugin<WallpaperPlugin>("DaldalWallpaper");
const COLORS = {
  ink: "#29252b",
  muted: "#8f8885",
  coral: "#d87568",
  lavender: "#6f63b6",
  mint: "#4c9d83",
  gold: "#b8894d",
  paper: "#fffdfb",
  line: "#e8e0db",
};

const pad = (value: number) => String(value).padStart(2, "0");
const toISO = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatWon = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const formatCompact = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 10000) return `${(absolute / 10000).toFixed(1).replace(".0", "")}만`;
  return new Intl.NumberFormat("ko-KR").format(absolute);
};

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 600, align: CanvasTextAlign = "left") {
  context.font = `${weight} ${size}px Pretendard, Arial, sans-serif`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function itemColor(type: WallpaperItem["type"]) {
  if (type === "todo") return COLORS.lavender;
  if (type === "event") return COLORS.coral;
  if (type === "income") return COLORS.mint;
  return type === "loan" ? COLORS.gold : COLORS.coral;
}

export async function createMonthlyWallpaper({ month, items, balance, income, expense, loan }: WallpaperOptions) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 2400;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  const background = context.createLinearGradient(0, 0, 1080, 2400);
  background.addColorStop(0, "#fbf8f4");
  background.addColorStop(0.55, "#fffdfb");
  background.addColorStop(1, "#f4f0ed");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.22;
  context.fillStyle = "#e8d8f4";
  context.beginPath();
  context.arc(970, 160, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f5c9bc";
  context.beginPath();
  context.arc(40, 2130, 230, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  drawText(context, "☾  DALDAL CALENDAR", 66, 92, 26, COLORS.coral, 800);
  drawText(context, "잠금화면용 월간 플래너", 1014, 92, 18, COLORS.muted, 600, "right");
  drawText(context, month.toLocaleDateString("ko-KR", { year: "numeric", month: "long" }), 66, 196, 54, COLORS.ink, 850);
  drawText(context, "한 달의 기록을 한눈에 차곡차곡", 68, 248, 21, COLORS.muted, 600);

  roundedRect(context, 66, 302, 948, 164, 26);
  context.fillStyle = "#756bb5";
  context.fill();
  drawText(context, "이번 달 남은 금액", 100, 350, 19, "rgba(255,255,255,.72)", 700);
  drawText(context, formatWon(balance), 100, 406, 42, "#fffdfb", 850);
  drawText(context, `수입 ${formatCompact(income)}  ·  지출 ${formatCompact(expense)}  ·  대출 ${formatCompact(loan)}`, 100, 443, 17, "rgba(255,255,255,.78)", 600);
  drawText(context, "달달", 957, 382, 26, "rgba(255,255,255,.8)", 850, "right");

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellWidth = 132;
  const left = 66;
  const gridTop = 598;
  const cellHeight = 150;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dateItems = new Map<string, WallpaperItem[]>();
  items.forEach((item) => dateItems.set(item.date, [...(dateItems.get(item.date) ?? []), item]));

  weekdays.forEach((day, index) => drawText(context, day, left + index * cellWidth + cellWidth / 2, 528, 19, index === 0 ? COLORS.coral : index === 6 ? COLORS.lavender : COLORS.muted, 800, "center"));
  context.strokeStyle = COLORS.line;
  context.lineWidth = 1;
  for (let row = 0; row < 6; row += 1) {
    const y = gridTop + row * cellHeight;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(left + cellWidth * 7, y);
    context.stroke();
  }
  for (let column = 0; column <= 7; column += 1) {
    context.beginPath();
    context.moveTo(left + column * cellWidth, gridTop);
    context.lineTo(left + column * cellWidth, gridTop + cellHeight * 6);
    context.stroke();
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const index = firstDay + day - 1;
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = left + column * cellWidth;
    const y = gridTop + row * cellHeight;
    const date = new Date(year, monthIndex, day);
    const iso = toISO(date);
    const dayItems = dateItems.get(iso) ?? [];
    const isToday = iso === toISO(new Date());
    if (isToday) {
      context.fillStyle = "#fff0ec";
      roundedRect(context, x + 7, y + 8, cellWidth - 14, cellHeight - 16, 16);
      context.fill();
    }
    drawText(context, String(day), x + 17, y + 28, 24, column === 0 ? COLORS.coral : column === 6 ? COLORS.lavender : COLORS.ink, 800);
    if (isToday) drawText(context, "오늘", x + cellWidth - 16, y + 28, 13, COLORS.coral, 800, "right");
    dayItems.slice(0, 3).forEach((item, itemIndex) => {
      const chipY = y + 62 + itemIndex * 27;
      context.fillStyle = itemColor(item.type);
      roundedRect(context, x + 12, chipY, cellWidth - 24, 21, 7);
      context.fill();
      const title = item.title.length > 9 ? `${item.title.slice(0, 8)}…` : item.title;
      drawText(context, title, x + 20, chipY + 10, 12, "#ffffff", 700);
    });
  }

  const listTop = gridTop + 6 * cellHeight + 76;
  drawText(context, "이번 달 주요 기록", 66, listTop, 25, COLORS.ink, 850);
  drawText(context, "할 일 · 일정 · 금융 기록", 1014, listTop, 16, COLORS.muted, 600, "right");
  const upcoming = [...items].filter((item) => item.date.startsWith(`${year}-${pad(monthIndex + 1)}`)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  upcoming.forEach((item, index) => {
    const y = listTop + 55 + index * 63;
    context.fillStyle = COLORS.paper;
    roundedRect(context, 66, y - 23, 948, 48, 14);
    context.fill();
    context.strokeStyle = COLORS.line;
    context.stroke();
    context.fillStyle = itemColor(item.type);
    context.beginPath();
    context.arc(91, y, 7, 0, Math.PI * 2);
    context.fill();
    drawText(context, `${fromISO(item.date).getDate()}일`, 114, y, 16, COLORS.muted, 750);
    drawText(context, item.title, 190, y, 17, COLORS.ink, 750);
    drawText(context, item.time ?? (item.amount ? `${item.type === "income" ? "+" : "−"}${formatCompact(item.amount)}` : ""), 975, y, 15, item.type === "income" ? COLORS.mint : COLORS.muted, 750, "right");
  });

  drawText(context, "달달 캘린더  ·  오늘도 차곡차곡", 66, 2318, 16, COLORS.muted, 700);
  drawText(context, "배경화면을 저장해 잠금화면에 설정해 보세요", 1014, 2318, 15, COLORS.muted, 600, "right");
  return canvas.toDataURL("image/png");
}

function fromISO(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function downloadWallpaper(dataUrl: string, month: Date) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `daldal-${month.getFullYear()}-${pad(month.getMonth() + 1)}-lockscreen.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function setNativeLockScreenWallpaper(dataUrl: string) {
  if (!Capacitor.isNativePlatform()) return false;
  await Wallpaper.setLockScreenWallpaper({ image: dataUrl });
  return true;
}

export async function openNativeLiveWallpaperSettings() {
  if (!Capacitor.isNativePlatform()) return false;
  await Wallpaper.openLiveWallpaperSettings();
  return true;
}
