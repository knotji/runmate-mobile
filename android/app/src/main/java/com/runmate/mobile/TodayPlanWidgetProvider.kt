package com.runmate.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject

class TodayPlanWidgetProvider : AppWidgetProvider() {
    companion object {
        /** Sent by [TodayPlanWidgetPlugin] right after fresh plan data is written, so the
         * widget refreshes immediately instead of waiting for its own update schedule. */
        const val ACTION_REFRESH = "com.runmate.mobile.action.REFRESH_TODAY_PLAN_WIDGET"

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodayPlanWidgetProvider::class.java))
            if (ids.isEmpty()) return
            updateWidgets(context, manager, ids)
        }

        private fun updateWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val plan = TodayPlanWidgetStore.load(context)
            for (id in ids) manager.updateAppWidget(id, buildRemoteViews(context, plan))
        }

        private fun buildRemoteViews(context: Context, plan: JSONObject?): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.today_plan_widget)
            val status = plan?.optString("status")?.takeIf { it.isNotBlank() } ?: "no_plan"

            views.setTextViewText(R.id.widget_workout_type, workoutTypeLabel(plan, status))
            views.setTextViewText(R.id.widget_meta, metaLabel(plan, status))

            val (badgeText, badgeDrawable, badgeTextColor) = badgeFor(status)
            views.setTextViewText(R.id.widget_status_badge, badgeText)
            views.setInt(R.id.widget_status_badge, "setBackgroundResource", badgeDrawable)
            views.setTextColor(R.id.widget_status_badge, badgeTextColor)

            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.Builder()
                    .scheme("com.runmate.mobile")
                    .authority("navigate")
                    .appendQueryParameter("route", "/weekly-plan")
                    .build()
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 51001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(android.R.id.background, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_workout_type, pendingIntent)
            return views
        }

        private fun workoutTypeLabel(plan: JSONObject?, status: String): String {
            if (status == "no_plan") return "No Plan Yet"
            return plan?.optString("workoutType")?.takeIf { it.isNotBlank() } ?: "No Plan Yet"
        }

        private fun metaLabel(plan: JSONObject?, status: String): String {
            if (status == "no_plan") return "Set a Race Goal in RunMate"
            if (status == "rest") return "Take it easy today"
            val distance = plan?.optDouble("distanceKm")?.takeIf { !it.isNaN() }
            val pace = plan?.optString("pace")?.takeIf { it.isNotBlank() }
            return listOfNotNull(
                distance?.let { "${trimTrailingZero(it)} km" },
                pace,
            ).joinToString(" · ").ifBlank { plan?.optString("description")?.takeIf { it.isNotBlank() } ?: "" }
        }

        private fun trimTrailingZero(value: Double): String =
            if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()

        private fun badgeFor(status: String): Triple<String, Int, Int> = when (status) {
            "completed" -> Triple("Done", R.drawable.widget_badge_completed, 0xFF147A66.toInt())
            "logged_different" -> Triple("Different", R.drawable.widget_badge_different, 0xFF9B6729.toInt())
            "rest" -> Triple("Rest", R.drawable.widget_badge_rest, 0xFF667B92.toInt())
            "no_plan" -> Triple("—", R.drawable.widget_badge_rest, 0xFFA3B1BD.toInt())
            else -> Triple("To Do", R.drawable.widget_badge_pending, 0xFF176F9F.toInt())
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateWidgets(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(context)
    }
}
