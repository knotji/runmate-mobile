package com.runmate.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
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

        fun refreshOne(context: Context, appWidgetId: Int) {
            updateWidgets(context, AppWidgetManager.getInstance(context), intArrayOf(appWidgetId))
        }

        private fun updateWidgets(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val plan = TodayPlanWidgetStore.load(context)
            for (id in ids) manager.updateAppWidget(id, buildRemoteViews(context, plan, id))
        }

        private fun buildRemoteViews(context: Context, plan: JSONObject?, appWidgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.today_plan_widget)
            val status = plan?.optString("status")?.takeIf { it.isNotBlank() } ?: "no_plan"

            views.setInt(R.id.widget_root, "setBackgroundResource", backgroundFor(TodayPlanWidgetConfig.backgroundStyle(context, appWidgetId)))
            views.setTextViewText(R.id.widget_workout_type, workoutTypeLabel(plan, status))
            views.setTextViewText(R.id.widget_meta, metaLabel(plan, status))

            val (badgeText, badgeDrawable, badgeTextColor) = badgeFor(status)
            views.setTextViewText(R.id.widget_status_badge, badgeText)
            views.setInt(R.id.widget_status_badge, "setBackgroundResource", badgeDrawable)
            views.setTextColor(R.id.widget_status_badge, badgeTextColor)

            applyRecoveryBadge(views, plan, TodayPlanWidgetConfig.showRecovery(context, appWidgetId))

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

        private fun backgroundFor(style: WidgetBackgroundStyle): Int = when (style) {
            WidgetBackgroundStyle.FROSTED -> R.drawable.widget_bg_frosted
            WidgetBackgroundStyle.SOLID -> R.drawable.widget_bg_solid
            WidgetBackgroundStyle.TRANSPARENT -> android.R.color.transparent
        }

        private fun applyRecoveryBadge(views: RemoteViews, plan: JSONObject?, showRecovery: Boolean) {
            val score = plan?.optInt("recoveryScore", -1)?.takeIf { it in 0..100 }
            if (!showRecovery || score == null) {
                views.setViewVisibility(R.id.widget_recovery_badge, View.GONE)
                return
            }
            val zone = plan?.optString("recoveryZone")
            val (drawable, textColor) = when (zone) {
                "good" -> R.drawable.widget_badge_completed to 0xFF147A66.toInt()
                "fair" -> R.drawable.widget_badge_different to 0xFF9B6729.toInt()
                else -> R.drawable.widget_badge_low to 0xFFB5495A.toInt()
            }
            views.setViewVisibility(R.id.widget_recovery_badge, View.VISIBLE)
            views.setTextViewText(R.id.widget_recovery_badge, "Recovery $score")
            views.setInt(R.id.widget_recovery_badge, "setBackgroundResource", drawable)
            views.setTextColor(R.id.widget_recovery_badge, textColor)
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

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        for (id in appWidgetIds) TodayPlanWidgetConfig.clear(context, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(context)
    }
}
