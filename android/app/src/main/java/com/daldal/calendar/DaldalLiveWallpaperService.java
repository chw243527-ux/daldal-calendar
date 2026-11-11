package com.daldal.calendar;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.service.wallpaper.WallpaperService;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

public class DaldalLiveWallpaperService extends WallpaperService {
    @Override
    public Engine onCreateEngine() {
        return new DaldalEngine();
    }

    private final class DaldalEngine extends Engine {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Handler refreshHandler = new Handler(Looper.getMainLooper());
        private final Runnable refreshRunnable = new Runnable() {
            @Override public void run() {
                if (visible) {
                    drawWallpaper();
                    refreshHandler.postDelayed(this, 30000L);
                }
            }
        };
        private final Calendar now = Calendar.getInstance();
        private boolean visible;
        private String selectedFinanceType;
        private final SharedPreferences.OnSharedPreferenceChangeListener preferenceListener = (preferences, key) -> {
            if ("backgroundTheme".equals(key) || "fontScale".equals(key) || "customBackgroundColor".equals(key) || "customAccentColor".equals(key) || "showCalendar".equals(key) || "showSchedule".equals(key) || "showTodo".equals(key) || "showMonthlyFunds".equals(key) || "calendarItems".equals(key)) {
                drawWallpaper();
            }
        };

        @Override
        public void onVisibilityChanged(boolean visible) {
            this.visible = visible;
            refreshHandler.removeCallbacks(refreshRunnable);
            if (visible) {
                drawWallpaper();
                refreshHandler.postDelayed(refreshRunnable, 30000L);
            }
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            drawWallpaper();
        }

        @Override
        public void onSurfaceCreated(SurfaceHolder holder) {
            getSharedPreferences("daldal_widget", Context.MODE_PRIVATE).registerOnSharedPreferenceChangeListener(preferenceListener);
            setTouchEventsEnabled(true);
            drawWallpaper();
            if (visible) refreshHandler.postDelayed(refreshRunnable, 30000L);
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            getSharedPreferences("daldal_widget", Context.MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(preferenceListener);
            visible = false;
            refreshHandler.removeCallbacks(refreshRunnable);
            super.onSurfaceDestroyed(holder);
        }

        @Override
        public void onTouchEvent(MotionEvent event) {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                if (!selectFinanceChart(event.getX(), event.getY())) {
                    if (selectedFinanceType != null) {
                        selectedFinanceType = null;
                        drawWallpaper();
                    } else {
                        toggleTodoAt(event.getY());
                    }
                }
            }
            super.onTouchEvent(event);
        }

        private boolean selectFinanceChart(float pixelX, float pixelY) {
            int pixelWidth = getSurfaceHolder().getSurfaceFrame().width();
            int pixelHeight = getSurfaceHolder().getSurfaceFrame().height();
            if (pixelWidth <= 0 || pixelHeight <= 0) return false;
            float scale = pixelWidth / 360f;
            float x = pixelX / scale;
            float y = pixelY / scale;
            int width = Math.round(pixelWidth / scale);
            int height = Math.round(pixelHeight / scale);
            float margin = width * 0.075f;
            float cardTop = height * 0.18f;
            float chartX = width - margin - 161;
            float chartY = cardTop + 30;
            if (x < chartX || x > width - margin + 4 || y < chartY + 5 || y > chartY + 88) return false;
            int row = (int) ((y - (chartY + 12)) / 22f);
            if (row < 0 || row > 2) return false;
            selectedFinanceType = row == 0 ? "income" : row == 1 ? "expense" : "outgoing";
            drawWallpaper();
            return true;
        }

        private void toggleTodoAt(float pixelY) {
            int pixelWidth = getSurfaceHolder().getSurfaceFrame().width();
            if (pixelWidth <= 0) return;
            float scale = pixelWidth / 360f;
            float logicalY = pixelY / scale;
            int logicalHeight = Math.round(getSurfaceHolder().getSurfaceFrame().height() / scale);
            float cardTop = logicalHeight * 0.18f;
            int targetRow = Math.round((logicalY - (cardTop + 63f)) / 23f);
            if (targetRow < 0 || targetRow > 2) return;

            SharedPreferences preferences = getSharedPreferences("daldal_widget", Context.MODE_PRIVATE);
            JSONArray entries = parseItems(preferences.getString("calendarItems", "[]"));
            String todayKey = String.format(Locale.US, "%04d-%02d-%02d", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
            int visibleRow = 0;
            for (int index = 0; index < entries.length(); index++) {
                JSONObject item = entries.optJSONObject(index);
                if (item == null || !todayKey.equals(item.optString("date"))) continue;
                String type = item.optString("type");
                if (!"todo".equals(type) && !"event".equals(type)) continue;
                if (visibleRow == targetRow && "todo".equals(type)) {
                    try {
                        item.put("completed", !item.optBoolean("completed", false));
                        preferences.edit().putString("calendarItems", entries.toString()).apply();
                        drawWallpaper();
                    } catch (Exception ignored) {
                        // Keep the existing wallpaper state when a malformed record is tapped.
                    }
                    return;
                }
                visibleRow++;
            }
        }

        private void drawWallpaper() {
            SurfaceHolder holder = getSurfaceHolder();
            Canvas canvas = null;
            try {
                canvas = holder.lockCanvas();
                if (canvas == null) return;
                drawCanvas(canvas);
            } finally {
                if (canvas != null) holder.unlockCanvasAndPost(canvas);
            }
        }

        private void drawCanvas(Canvas canvas) {
            int pixelWidth = canvas.getWidth();
            int pixelHeight = canvas.getHeight();
            float scale = pixelWidth / 360f;
            canvas.save();
            canvas.scale(scale, scale);
            int width = Math.round(pixelWidth / scale);
            int height = Math.round(pixelHeight / scale);

            SharedPreferences preferences = getSharedPreferences("daldal_widget", Context.MODE_PRIVATE);
            String backgroundTheme = preferences.getString("backgroundTheme", "ivory");
            int background = parseColor(preferences.getString("customBackgroundColor", ""), backgroundColor(backgroundTheme));
            boolean darkTheme = isDarkTheme(background);
            canvas.drawColor(background);
            paint.setTextScaleX(fontScale(preferences.getString("fontScale", "medium")));

            paint.setStyle(Paint.Style.FILL);

            String calendarItems = preferences.getString("calendarItems", "[]");
            String lunarCalendar = preferences.getString("lunarCalendar", "[]");
            boolean showCalendar = preferences.getBoolean("showCalendar", true);
            boolean showSchedule = preferences.getBoolean("showSchedule", true);
            boolean showTodo = preferences.getBoolean("showTodo", true);

            float margin = width * 0.045f;
            drawText(canvas, "☾  달달 캘린더", margin, height * 0.055f, 12, primaryTextColor(darkTheme), true);
            float cardTop = height * 0.095f;
            JSONArray entries = parseItems(calendarItems);
            int year = now.get(Calendar.YEAR);
            int month = now.get(Calendar.MONTH);
            Calendar first = Calendar.getInstance();
            first.set(year, month, 1);
            int firstDay = first.get(Calendar.DAY_OF_WEEK) - 1;
            int days = first.getActualMaximum(Calendar.DAY_OF_MONTH);
            float gridTop = cardTop + 18;
            float cellWidth = (width - margin * 2) / 7f;
            // 잠금화면은 달력만 표시하므로 6주 행을 화면 높이에 맞춰 크게 사용합니다.
            float cellHeight = Math.max(72f, Math.min(118f, (height - gridTop - 70f) / 6f));
            String[] weekdays = {"일", "월", "화", "수", "목", "금", "토"};
            if (showCalendar) {
                drawText(canvas, String.format(Locale.KOREA, "%d년 %d월", year, month + 1), margin, gridTop - 16, 15, primaryTextColor(darkTheme), true);
                for (int index = 0; index < weekdays.length; index++) {
                    drawCenteredText(canvas, weekdays[index], margin + index * cellWidth + cellWidth / 2, gridTop, 10, index == 0 ? Color.rgb(216,117,104) : index == 6 ? Color.rgb(111,99,182) : secondaryTextColor(darkTheme), true);
                }
                for (int day = 1; day <= days; day++) {
                    int index = firstDay + day - 1;
                    int column = index % 7;
                    int row = index / 7;
                    float cellX = margin + column * cellWidth;
                    float cellY = gridTop + 28 + row * cellHeight;
                    boolean isToday = day == now.get(Calendar.DAY_OF_MONTH);
                    if (isToday) { paint.setColor(parseColor(preferences.getString("customAccentColor", ""), themeAccent(backgroundTheme))); canvas.drawCircle(cellX + cellWidth / 2, cellY, 14, paint); }
                    drawCenteredText(canvas, String.valueOf(day), cellX + cellWidth / 2, cellY, 12, isToday ? Color.WHITE : primaryTextColor(darkTheme), true);
                    String lunarLabel = lunarLabel(parseItems(lunarCalendar), year, month + 1, day);
                    if (!lunarLabel.isEmpty()) drawCenteredText(canvas, lunarLabel, cellX + cellWidth / 2, cellY + 20, 8, isToday ? themeAccent(backgroundTheme) : secondaryTextColor(darkTheme), false);
                }
            }
            canvas.restore();
        }

        private void drawCellItems(Canvas canvas, JSONArray entries, int year, int month, int day, float cellX, float y, float cellWidth, boolean showSchedule, boolean showTodo, boolean darkTheme) {
            String key = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day);
            int shown = 0;
            for (int i = 0; i < entries.length() && shown < 2; i++) {
                JSONObject item = entries.optJSONObject(i);
                if (item == null || !key.equals(item.optString("date"))) continue;
                String type = item.optString("type");
                if (("event".equals(type) && !showSchedule) || ("todo".equals(type) && !showTodo) || (!"event".equals(type) && !"todo".equals(type))) continue;
                int color = itemColor(type, item.optString("accentColor", ""));
                boolean completed = "todo".equals(type) && item.optBoolean("completed", false);
                String title = safeTitle(item.optString("title", "기록"), 9);
                float left = cellX + 1, right = cellX + cellWidth - 1, top = y + shown * 16;
                if ("event".equals(type)) {
                    paint.setColor(blend(color, Color.rgb(249, 246, 242), .84f));
                    canvas.drawRoundRect(new RectF(left, top, right, top + 14), 4, 4, paint);
                    drawText(canvas, title, left + 4, top + 10, 7, color, true);
                } else {
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.7f); paint.setColor(color); canvas.drawCircle(left + 6, top + 7, 4.3f, paint);
                    if (completed) { paint.setStyle(Paint.Style.FILL); canvas.drawCircle(left + 6, top + 7, 4.3f, paint); drawText(canvas, "✓", left + 3.2f, top + 9.5f, 6, Color.WHITE, true); }
                    paint.setStyle(Paint.Style.FILL); drawText(canvas, title, left + 14, top + 10, 7, completed ? secondaryTextColor(darkTheme) : color, false);
                    if (completed) { paint.setColor(color); paint.setStrokeWidth(1.2f); canvas.drawLine(left + 14, top + 7, Math.min(right, left + 14 + paint.measureText(title)), top + 7, paint); }
                }
                shown++;
            }
        }

        private String lunarLabel(JSONArray days, int year, int month, int day) {
            String key = String.format(Locale.US, "%04d-%02d-%02d", year, month, day);
            for (int i = 0; i < days.length(); i++) { JSONObject value = days.optJSONObject(i); if (value != null && key.equals(value.optString("date"))) return value.optString("label", ""); }
            return "";
        }

        private int blend(int foreground, int background, float backgroundRatio) {
            return Color.rgb(Math.round(Color.red(foreground) * (1 - backgroundRatio) + Color.red(background) * backgroundRatio), Math.round(Color.green(foreground) * (1 - backgroundRatio) + Color.green(background) * backgroundRatio), Math.round(Color.blue(foreground) * (1 - backgroundRatio) + Color.blue(background) * backgroundRatio));
        }

        private JSONArray parseItems(String value) {
            try { return new JSONArray(value); } catch (Exception ignored) { return new JSONArray(); }
        }

        private boolean dateMatches(String value, int year, int month, int day) {
            String prefix = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day);
            return value.startsWith(prefix);
        }

        private int backgroundColor(String theme) {
            if ("blush".equals(theme)) return Color.rgb(255, 240, 237);
            if ("sage".equals(theme)) return Color.rgb(237, 245, 240);
            if ("night".equals(theme)) return Color.rgb(37, 35, 42);
            return Color.rgb(249, 246, 242);
        }

        private int parseColor(String value, int fallback) {
            try { return value != null && value.startsWith("#") ? Color.parseColor(value) : fallback; } catch (Exception ignored) { return fallback; }
        }

        private float fontScale(String value) {
            if ("small".equals(value)) return 0.88f;
            if ("large".equals(value)) return 1.18f;
            return 1f;
        }

        private int themeAccent(String theme) {
            if ("blush".equals(theme)) return Color.rgb(205, 103, 91);
            if ("sage".equals(theme)) return Color.rgb(76, 137, 113);
            if ("night".equals(theme)) return Color.rgb(244, 167, 151);
            return Color.rgb(216, 117, 104);
        }

        private boolean isDarkTheme(String theme) {
            return isDarkTheme(backgroundColor(theme));
        }

        private boolean isDarkTheme(int color) {
            double luminance = (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255.0;
            return luminance < 0.52;
        }

        private int primaryTextColor(boolean darkTheme) {
            return darkTheme ? Color.rgb(248, 242, 238) : Color.rgb(47, 42, 49);
        }

        private int secondaryTextColor(boolean darkTheme) {
            return darkTheme ? Color.rgb(210, 201, 205) : Color.rgb(143, 136, 133);
        }

        private int itemColor(String type, String accentColor) {
            if (accentColor != null && accentColor.startsWith("#")) { try { return Color.parseColor(accentColor); } catch (Exception ignored) {} }
            if ("todo".equals(type)) return Color.rgb(111, 99, 182);
            if ("event".equals(type)) return Color.rgb(232, 130, 114);
            if ("income".equals(type)) return Color.rgb(76, 157, 131);
            if ("loan".equals(type)) return Color.rgb(184, 137, 77);
            return Color.rgb(216, 117, 104);
        }

        private boolean isOutgoingCategory(String category) {
            return "카드값".equals(category) || "대출".equals(category);
        }

        private String safeTitle(String value, int maxLength) {
            if (value == null || value.trim().isEmpty()) return "기록";
            String clean = value.trim();
            return clean.length() > maxLength ? clean.substring(0, Math.max(1, maxLength - 1)) + "…" : clean;
        }

        private void drawFinanceDetails(Canvas canvas, JSONArray entries, float x, float y, float panelWidth, String type) {
            paint.setColor(0xF7FFFFFF);
            canvas.drawRoundRect(new RectF(x, y, x + panelWidth, y + 184), 18, 18, paint);
            String label = "income".equals(type) ? "수입" : "expense".equals(type) ? "지출" : "나갈 돈";
            int total = 0;
            int count = 0;
            String monthPrefix = String.format(Locale.US, "%04d-%02d-", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1);
            for (int index = 0; index < entries.length(); index++) {
                JSONObject item = entries.optJSONObject(index);
                boolean matches = item != null && (type.equals(item.optString("type")) || ("outgoing".equals(type) && "loan".equals(item.optString("type")) && isOutgoingCategory(item.optString("category"))));
                if (matches && item.optString("date", "").startsWith(monthPrefix)) {
                    total += item.optInt("amount", 0);
                    count++;
                }
            }
            boolean darkTheme = isDarkTheme(getSharedPreferences("daldal_widget", Context.MODE_PRIVATE).getString("backgroundTheme", "ivory"));
            drawText(canvas, label + " 상세", x + 18, y + 27, 14, primaryTextColor(darkTheme), true);
            drawText(canvas, count + "건 · " + compactWon(total), x + panelWidth - 18, y + 27, 13, itemColor(type, ""), true, true);
            int row = 0;
            for (int index = 0; index < entries.length() && row < 5; index++) {
                JSONObject item = entries.optJSONObject(index);
                boolean matches = item != null && (type.equals(item.optString("type")) || ("outgoing".equals(type) && "loan".equals(item.optString("type")) && isOutgoingCategory(item.optString("category"))));
                if (!matches || !item.optString("date", "").startsWith(monthPrefix)) continue;
                String title = item.optString("title", "기록");
                if (title.length() > 17) title = title.substring(0, 16) + "…";
                float rowY = y + 53 + row * 24;
                drawText(canvas, item.optString("date", "").substring(5), x + 18, rowY, 11, secondaryTextColor(darkTheme), false);
                drawText(canvas, title, x + 61, rowY, 13, primaryTextColor(darkTheme), false);
                drawText(canvas, compactWon(item.optInt("amount", 0)), x + panelWidth - 18, rowY, 12, itemColor(type, ""), true, true);
                row++;
            }
            if (row == 0) drawText(canvas, "이번 달 내역이 없어요", x + 18, y + 67, 13, secondaryTextColor(darkTheme), false);
            drawText(canvas, "차트 밖을 터치하면 닫혀요", x + 18, y + 169, 10, secondaryTextColor(darkTheme), false);
        }

        private void drawFinanceChart(Canvas canvas, float x, float y, float chartWidth, int income, int expense, int loan, boolean darkTheme) {
            drawText(canvas, "월간 자금", x, y, 11, primaryTextColor(darkTheme), true);
            int max = Math.max(1, Math.max(income, Math.max(expense, loan)));
            String[] labels = {"수입", "지출", "나갈 돈"};
            int[] values = {income, expense, loan};
            int[] colors = {Color.rgb(137, 218, 183), Color.rgb(255, 184, 166), Color.rgb(244, 205, 125)};
            for (int index = 0; index < labels.length; index++) {
                float rowY = y + 19 + index * 22;
                drawText(canvas, labels[index], x, rowY + 9, 9, secondaryTextColor(darkTheme), false);
                paint.setColor(0x2A8F8885);
                canvas.drawRoundRect(new RectF(x + 29, rowY + 2, x + chartWidth, rowY + 9), 4, 4, paint);
                paint.setColor(colors[index]);
                float barWidth = (chartWidth - 29) * values[index] / (float) max;
                if (barWidth > 0) canvas.drawRoundRect(new RectF(x + 29, rowY + 2, x + 29 + Math.max(4, barWidth), rowY + 9), 4, 4, paint);
            }
        }

        private String compactWon(int value) {
            if (Math.abs(value) >= 10000) return NumberFormat.getNumberInstance(Locale.KOREA).format(value / 10000) + "만";
            return NumberFormat.getNumberInstance(Locale.KOREA).format(value);
        }

        private void drawText(Canvas canvas, String value, float x, float y, float size, int color, boolean bold) {
            drawText(canvas, value, x, y, size, color, bold, false);
        }

        private void drawText(Canvas canvas, String value, float x, float y, float size, int color, boolean bold, boolean right) {
            paint.setColor(color);
            paint.setTextSize(size * fontScale(getSharedPreferences("daldal_widget", Context.MODE_PRIVATE).getString("fontScale", "medium")));
            paint.setTypeface(android.graphics.Typeface.create("sans", bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL));
            paint.setTextAlign(right ? Paint.Align.RIGHT : Paint.Align.LEFT);
            canvas.drawText(value, x, y, paint);
        }

        private void drawCenteredText(Canvas canvas, String value, float x, float y, float size, int color, boolean bold) {
            paint.setColor(color);
            paint.setTextSize(size * fontScale(getSharedPreferences("daldal_widget", Context.MODE_PRIVATE).getString("fontScale", "medium")));
            paint.setTypeface(android.graphics.Typeface.create("sans", bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL));
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(value, x, y + size * .35f, paint);
        }
    }
}
