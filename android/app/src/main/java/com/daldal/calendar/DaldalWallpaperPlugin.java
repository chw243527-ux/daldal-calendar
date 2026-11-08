package com.daldal.calendar;

import android.app.WallpaperManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;

@CapacitorPlugin(name = "DaldalWallpaper")
public class DaldalWallpaperPlugin extends Plugin {
    @PluginMethod
    public void setLockScreenWallpaper(PluginCall call) {
        String image = call.getString("image", "");
        if (image.isEmpty()) {
            call.reject("배경 이미지가 없습니다.");
            return;
        }

        try {
            String encoded = image.contains(",") ? image.substring(image.indexOf(',') + 1) : image;
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeStream(new ByteArrayInputStream(bytes));
            if (bitmap == null) {
                call.reject("PNG 이미지를 읽을 수 없습니다.");
                return;
            }

            WallpaperManager manager = WallpaperManager.getInstance(getContext());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
            } else {
                manager.setBitmap(bitmap);
            }
            bitmap.recycle();
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("잠금화면 배경 적용에 실패했습니다.", error);
        }
    }
}
