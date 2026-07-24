package com.runmate.mobile

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "TodayPlanWidget")
class TodayPlanWidgetPlugin : Plugin() {
    @PluginMethod
    fun updateTodayPlan(call: PluginCall) {
        val planJson = call.getString("planJson")
        if (planJson.isNullOrBlank()) {
            call.reject("planJson is required")
            return
        }
        TodayPlanWidgetStore.save(context, planJson)
        TodayPlanWidgetProvider.refreshAll(context)
        call.resolve()
    }
}
