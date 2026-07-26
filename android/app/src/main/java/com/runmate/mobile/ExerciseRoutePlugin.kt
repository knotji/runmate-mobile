package com.runmate.mobile

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract
import androidx.health.connect.client.readRecord
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "ExerciseRoute")
class ExerciseRoutePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val routeContract = ExerciseRouteRequestContract()

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun read(call: PluginCall) {
        val workoutId = call.getString("workoutId")
        if (workoutId.isNullOrBlank()) {
            call.reject("A Health Connect workout ID is required.")
            return
        }

        scope.launch {
            if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
                call.reject("Health Connect is unavailable.")
                return@launch
            }

            try {
                val client = HealthConnectClient.getOrCreate(context)
                val session = client.readRecord<ExerciseSessionRecord>(workoutId).record
                when (val result = session.exerciseRouteResult) {
                    is ExerciseRouteResult.Data -> call.resolve(routePayload(workoutId, result.exerciseRoute))
                    is ExerciseRouteResult.NoData -> call.resolve(emptyRoutePayload(workoutId, "no_data"))
                    is ExerciseRouteResult.ConsentRequired -> {
                        val intent = routeContract.createIntent(context, workoutId)
                        startActivityForResult(call, intent, "handleRouteConsent")
                    }
                }
            } catch (error: Exception) {
                call.reject("Exercise route could not be read.", error)
            }
        }
    }

    @ActivityCallback
    private fun handleRouteConsent(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val workoutId = call.getString("workoutId").orEmpty()
        val route = routeContract.parseResult(result.resultCode, result.data)
        if (route == null) {
            call.resolve(emptyRoutePayload(workoutId, "denied_or_unavailable"))
        } else {
            call.resolve(routePayload(workoutId, route))
        }
    }

    private fun routePayload(workoutId: String, route: ExerciseRoute) = JSObject().apply {
        put("workoutId", workoutId)
        put("status", "available")
        put("points", JSArray().apply {
            route.route.forEach { location ->
                put(JSObject().apply {
                    put("at", location.time.toString())
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    location.altitude?.let { put("altitudeMeters", it.inMeters) }
                    location.horizontalAccuracy?.let { put("horizontalAccuracyMeters", it.inMeters) }
                    location.verticalAccuracy?.let { put("verticalAccuracyMeters", it.inMeters) }
                })
            }
        })
    }

    private fun emptyRoutePayload(workoutId: String, status: String) = JSObject().apply {
        put("workoutId", workoutId)
        put("status", status)
        put("points", JSArray())
    }
}
