package com.runmate.mobile

import android.content.Context

internal enum class WidgetBackgroundStyle {
    TRANSPARENT, FROSTED, SOLID;

    companion object {
        fun fromName(name: String?): WidgetBackgroundStyle = entries.find { it.name == name } ?: TRANSPARENT
    }
}

/** Per-widget-instance preferences set from TodayPlanWidgetConfigureActivity. */
internal object TodayPlanWidgetConfig {
    private const val PREFERENCES = "runmate_widget_today_plan_config"
    private const val DEFAULT_SHOW_RECOVERY = true

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun backgroundStyle(context: Context, appWidgetId: Int): WidgetBackgroundStyle =
        WidgetBackgroundStyle.fromName(preferences(context).getString(styleKey(appWidgetId), null))

    fun showRecovery(context: Context, appWidgetId: Int): Boolean =
        preferences(context).getBoolean(showRecoveryKey(appWidgetId), DEFAULT_SHOW_RECOVERY)

    fun save(context: Context, appWidgetId: Int, style: WidgetBackgroundStyle, showRecovery: Boolean) {
        preferences(context).edit()
            .putString(styleKey(appWidgetId), style.name)
            .putBoolean(showRecoveryKey(appWidgetId), showRecovery)
            .apply()
    }

    fun clear(context: Context, appWidgetId: Int) {
        preferences(context).edit()
            .remove(styleKey(appWidgetId))
            .remove(showRecoveryKey(appWidgetId))
            .apply()
    }

    private fun styleKey(appWidgetId: Int) = "style_$appWidgetId"
    private fun showRecoveryKey(appWidgetId: Int) = "show_recovery_$appWidgetId"
}
