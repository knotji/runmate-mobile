package com.runmate.mobile

import android.content.Context
import org.json.JSONObject

internal object TodayPlanWidgetStore {
    private const val PREFERENCES = "runmate_widget_today_plan"
    private const val PLAN_JSON = "plan_json"

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun save(context: Context, planJson: String) {
        preferences(context).edit().putString(PLAN_JSON, planJson).apply()
    }

    fun load(context: Context): JSONObject? {
        val raw = preferences(context).getString(PLAN_JSON, null) ?: return null
        return try { JSONObject(raw) } catch (_: Exception) { null }
    }
}
