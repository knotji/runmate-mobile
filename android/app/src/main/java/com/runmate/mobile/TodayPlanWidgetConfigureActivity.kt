package com.runmate.mobile

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.CheckBox
import android.widget.RadioGroup
import androidx.appcompat.app.AppCompatActivity

class TodayPlanWidgetConfigureActivity : AppCompatActivity() {
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.today_plan_widget_configure)

        appWidgetId = intent.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        findViewById<Button>(R.id.configure_add_button).setOnClickListener { save() }
    }

    private fun save() {
        val styleGroup = findViewById<RadioGroup>(R.id.configure_style_group)
        val style = when (styleGroup.checkedRadioButtonId) {
            R.id.configure_style_frosted -> WidgetBackgroundStyle.FROSTED
            R.id.configure_style_solid -> WidgetBackgroundStyle.SOLID
            else -> WidgetBackgroundStyle.TRANSPARENT
        }
        val showRecovery = findViewById<CheckBox>(R.id.configure_show_recovery).isChecked

        TodayPlanWidgetConfig.save(this, appWidgetId, style, showRecovery)
        TodayPlanWidgetProvider.refreshOne(this, appWidgetId)

        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        setResult(RESULT_OK, result)
        finish()
    }
}
