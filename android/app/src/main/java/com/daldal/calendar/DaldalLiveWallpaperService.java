package com.daldal.calendar;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.service.wallpaper.WallpaperService;
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
            drawWallpaper();
            if (visible) refreshHandler.postDelayed(refreshRunnable, 30000L);
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            visible = false;
            refreshHandler.removeCallbacks(refreshRunnable);
            super.onSurfaceDestroyed(holder);
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
            canvas.drawColor(Color.rgb(249, 246, 242));

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(216, 117, 104));
            canvas.drawCircle(width - 20, 90, 150, paint);
            paint.setColor(Color.rgb(223, 218, 244));
            canvas.drawCircle(5, height - 80, 180, paint);

            SharedPreferences preferences = getSharedPreferences("daldal_widget", Context.MODE_PRIVATE);
            String monthLabel = preferences.getString("monthLabel", "달달 캘린더");
            int todoCount = preferences.getInt("todoCount", 0);
            int eventCount = preferences.getInt("eventCount", 0);
            int balance = preferences.getInt("balance", 0);
            String calendarItems = preferences.getString("calendarItems", "[]");

            float margin = width * 0.075f;
            drawText(canvas, "☾  DALDAL CALENDAR", margin, height * 0.09f, 16, Color.WHITE, true);
            drawText(canvas, monthLabel, margin, height * 0.17f, 30, Color.rgb(47, 42, 49), true);
            drawText(canvas, "오늘도 차곡차곡", margin, height * 0.205f, 14, Color.rgb(121, 111, 106), false);

            float cardTop = height * 0.245f;
            paint.setColor(Color.rgb(112, 103, 177));
            canvas.drawRoundRect(new RectF(margin, cardTop, width - margin, cardTop + 218), 24, 24, paint);
            drawText(canvas, "오늘 할 일", margin + 24, cardTop + 32, 13, 0xB8FFFFFF, false);
            drawText(canvas, String.valueOf(todoCount) + "개", margin + 24, cardTop + 73, 27, Color.WHITE, true);
            drawText(canvas, "오늘 일정", width / 2f, cardTop + 32, 13, 0xB8FFFFFF, false);
            drawText(canvas, String.valueOf(eventCount) + "개", width / 2f, cardTop + 73, 27, Color.WHITE, true);
            drawText(canvas, "잔액", width - margin - 155, cardTop + 32, 13, 0xB8FFFFFF, false);
            drawText(canvas, compactWon(balance), width - margin - 155, cardTop + 73, 22, Color.WHITE, true);

            drawText(canvas, "오늘의 기록", margin + 24, cardTop + 112, 13, 0xB8FFFFFF, true);
            JSONArray entries = parseItems(calendarItems);
            String todayKey = String.format(Locale.US, "%04d-%02d-%02d", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
            int todayRow = 0;
            for (int itemIndex = 0; itemIndex < entries.length() && todayRow < 3; itemIndex++) {
                JSONObject item = entries.optJSONObject(itemIndex);
                if (item == null || !todayKey.equals(item.optString("date"))) continue;
                String type = item.optString("type");
                if (!"todo".equals(type) && !"event".equals(type)) continue;
                String title = item.optString("title", "기록");
                if (title.length() > 18) title = title.substring(0, 17) + "…";
                paint.setColor(itemColor(type));
                canvas.drawCircle(margin + 31, cardTop + 143 + todayRow * 23, 4, paint);
                drawText(canvas, title, margin + 45, cardTop + 143 + todayRow * 23, 14, Color.WHITE, false);
                if ("event".equals(type) && !item.optString("time", "").isEmpty()) {
                    drawText(canvas, item.optString("time"), width - margin - 24, cardTop + 143 + todayRow * 23, 12, 0xCFFFFFFF, false, true);
                }
                todayRow++;
            }
            if (todayRow == 0) drawText(canvas, "오늘 등록된 기록이 없어요", margin + 24, cardTop + 145, 14, 0xCFFFFFFF, false);

            int year = now.get(Calendar.YEAR);
            int month = now.get(Calendar.MONTH);
            Calendar first = Calendar.getInstance();
            first.set(year, month, 1);
            int firstDay = first.get(Calendar.DAY_OF_WEEK) - 1;
            int days = first.getActualMaximum(Calendar.DAY_OF_MONTH);
            float gridTop = cardTop + 276;
            float cellWidth = (width - margin * 2) / 7f;
            float cellHeight = Math.max(47f, Math.min(68f, height * 0.06f));
            String[] weekdays = {"일", "월", "화", "수", "목", "금", "토"};
            for (int index = 0; index < weekdays.length; index++) {
                drawCenteredText(canvas, weekdays[index], margin + index * cellWidth + cellWidth / 2, gridTop, 12, index == 0 ? Color.rgb(216,117,104) : index == 6 ? Color.rgb(111,99,182) : Color.rgb(143,136,133), true);
            }
            for (int day = 1; day <= days; day++) {
                int index = firstDay + day - 1;
                int column = index % 7;
                int row = index / 7;
                float x = margin + column * cellWidth;
                float y = gridTop + 31 + row * cellHeight;
                boolean isToday = day == now.get(Calendar.DAY_OF_MONTH);
                if (isToday) {
                    paint.setColor(Color.rgb(216,117,104));
                    canvas.drawCircle(x + cellWidth / 2, y, 15, paint);
                }
                drawCenteredText(canvas, String.valueOf(day), x + cellWidth / 2, y, 13, isToday ? Color.WHITE : Color.rgb(47,42,49), true);
                int markerCount = 0;
                for (int itemIndex = 0; itemIndex < entries.length() && markerCount < 3; itemIndex++) {
                    JSONObject item = entries.optJSONObject(itemIndex);
                    if (item == null || !dateMatches(item.optString("date"), year, month, day)) continue;
                    paint.setColor(itemColor(item.optString("type")));
                    canvas.drawCircle(x + cellWidth / 2 - 8 + markerCount * 8, y + 20, 3.5f, paint);
                    markerCount++;
                }
            }

            float footerY = Math.min(height - 92, gridTop + 6 * cellHeight + 54);
            drawText(canvas, "잠금화면에서 달력을 바로 확인해요", margin, footerY, 14, Color.rgb(121,111,106), false);
            drawText(canvas, "달달", width - margin, footerY, 18, Color.rgb(216,117,104), true, true);
            canvas.restore();
        }

        private JSONArray parseItems(String value) {
            try { return new JSONArray(value); } catch (Exception ignored) { return new JSONArray(); }
        }

        private boolean dateMatches(String value, int year, int month, int day) {
            String prefix = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day);
            return value.startsWith(prefix);
        }

        private int itemColor(String type) {
            if ("todo".equals(type)) return Color.rgb(111, 99, 182);
            if ("event".equals(type)) return Color.rgb(232, 130, 114);
            if ("income".equals(type)) return Color.rgb(76, 157, 131);
            if ("loan".equals(type)) return Color.rgb(184, 137, 77);
            return Color.rgb(216, 117, 104);
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
            paint.setTextSize(size);
            paint.setTypeface(android.graphics.Typeface.create("sans", bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL));
            paint.setTextAlign(right ? Paint.Align.RIGHT : Paint.Align.LEFT);
            canvas.drawText(value, x, y, paint);
        }

        private void drawCenteredText(Canvas canvas, String value, float x, float y, float size, int color, boolean bold) {
            paint.setColor(color);
            paint.setTextSize(size);
            paint.setTypeface(android.graphics.Typeface.create("sans", bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL));
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(value, x, y + size * .35f, paint);
        }
    }
}
