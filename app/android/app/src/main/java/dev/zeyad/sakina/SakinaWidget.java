package dev.zeyad.sakina;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/** Home-screen prayer widget. The app writes the next 7 days of times to Preferences key "widget" (SharedPreferences "CapacitorStorage");
 *  the widget only reads that — it works offline and needs no permissions. Refreshes every minute while the screen is on via an inexact alarm. */
public class SakinaWidget extends AppWidgetProvider {
    static final String TICK = "dev.zeyad.sakina.WIDGET_TICK";
    static final int[] N = {R.id.n0, R.id.n1, R.id.n2, R.id.n3, R.id.n4}, T = {R.id.t0, R.id.t1, R.id.t2, R.id.t3, R.id.t4};

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, build(c)); arm(c); }
    @Override public void onReceive(Context c, Intent i) { super.onReceive(c, i); if (TICK.equals(i.getAction())) refresh(c); }
    @Override public void onDisabled(Context c) { AlarmManager am = c.getSystemService(AlarmManager.class); if (am != null) am.cancel(tickPi(c)); }

    static PendingIntent tickPi(Context c) { return PendingIntent.getBroadcast(c, 4401, new Intent(c, SakinaWidget.class).setAction(TICK), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT); }
    static void arm(Context c) { AlarmManager am = c.getSystemService(AlarmManager.class); if (am == null) return; am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 60000, 60000, tickPi(c)); }

    public static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, SakinaWidget.class));
        if (ids.length == 0) return; RemoteViews v = build(c); for (int id : ids) m.updateAppWidget(id, v);
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_prayer);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 4402, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        try {
            String raw = c.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("widget", null);
            if (raw == null) return v;
            JSONObject w = new JSONObject(raw); boolean ar = !"en".equals(w.optString("lang", "ar"));
            TimeZone tz = TimeZone.getTimeZone(w.optString("tz", TimeZone.getDefault().getID()));
            SimpleDateFormat dayF = new SimpleDateFormat("yyyy-MM-dd", Locale.US); dayF.setTimeZone(tz);
            SimpleDateFormat hm = new SimpleDateFormat(w.optBoolean("h24", false) ? "HH:mm" : "h:mm", Locale.US); hm.setTimeZone(tz);
            long now = System.currentTimeMillis(); String today = dayF.format(new Date(now));
            JSONArray days = w.getJSONArray("days"); JSONObject d = null;
            for (int i = 0; i < days.length(); i++) if (today.equals(days.getJSONObject(i).optString("d"))) { d = days.getJSONObject(i); break; }
            if (d == null) { v.setTextViewText(R.id.w_sub, ar ? "افتح سكينة لتحديث المواقيت" : "Open Sakina to refresh times"); return v; }
            JSONArray p = d.getJSONArray("p"); String nextName = null; long nextAt = 0;
            for (int i = 0; i < p.length() && i < 5; i++) {
                JSONObject x = p.getJSONObject(i); long at = x.getLong("t");
                v.setTextViewText(N[i], x.optString(ar ? "ar" : "en")); v.setTextViewText(T[i], digits(hm.format(new Date(at)), ar));
                boolean next = nextName == null && at > now; if (next) { nextName = x.optString(ar ? "ar" : "en"); nextAt = at; }
                v.setTextColor(T[i], next ? 0xFFF1D79A : (at < now ? 0x99FFFFFF : 0xFFFFFFFF));
            }
            if (nextName == null) { /* after Isha → tomorrow's Fajr */
                for (int i = 0; i < days.length() - 1; i++) if (days.getJSONObject(i) == d || today.equals(days.getJSONObject(i).optString("d"))) {
                    JSONObject f = days.getJSONObject(i + 1).getJSONArray("p").getJSONObject(0); nextName = f.optString(ar ? "ar" : "en"); nextAt = f.getLong("t"); break; }
            }
            if (nextName != null) {
                long mins = Math.max(0, (nextAt - now) / 60000); String left = (mins >= 60 ? (mins / 60) + (ar ? " س " : "h ") : "") + (mins % 60) + (ar ? " د" : "m");
                v.setTextViewText(R.id.w_next, nextName + "  " + digits(hm.format(new Date(nextAt)), ar));
                v.setTextViewText(R.id.w_left, (ar ? "بعد " : "in ") + digits(left, ar));
            }
            v.setTextViewText(R.id.w_sub, w.optString("city", "") + (d.optString(ar ? "hijri" : "hijriEn", "").isEmpty() ? "" : " · " + d.optString(ar ? "hijri" : "hijriEn")));
        } catch (Exception ignored) {}
        return v;
    }

    static String digits(String s, boolean ar) { if (!ar) return s; StringBuilder b = new StringBuilder(); for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch); return b.toString(); }
}
