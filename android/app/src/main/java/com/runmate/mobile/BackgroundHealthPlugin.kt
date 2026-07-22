package com.runmate.mobile

import android.content.Intent
import android.app.ActivityManager
import android.os.PowerManager
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "BackgroundHealth")
class BackgroundHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val permissionContract = PermissionController.createRequestPermissionResultContract()

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        scope.launch { call.resolve(buildStatus()) }
    }

    @PluginMethod
    fun requestAccess(call: PluginCall) {
        scope.launch {
            val client = clientOrReject(call) ?: return@launch
            if (!featureAvailable(client)) {
                call.reject("Background Health access is unavailable on this device.")
                return@launch
            }
            val granted = client.permissionController.getGrantedPermissions()
            if (granted.contains(BACKGROUND_PERMISSION)) {
                call.resolve(buildStatus())
                return@launch
            }
            val intent: Intent = permissionContract.createIntent(context, setOf(BACKGROUND_PERMISSION))
            startActivityForResult(call, intent, "handlePermissionResult")
        }
    }

    @ActivityCallback
    private fun handlePermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch { call.resolve(buildStatus()) }
    }

    @PluginMethod
    fun setEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        scope.launch {
            if (enabled) {
                val client = clientOrReject(call) ?: return@launch
                val granted = client.permissionController.getGrantedPermissions()
                if (!featureAvailable(client) || !granted.contains(BACKGROUND_PERMISSION)) {
                    call.reject("Allow Background Health access before enabling Automatic Sync.")
                    return@launch
                }
            }
            BackgroundHealthStore.setEnabled(context, enabled)
            if (enabled) schedulePeriodic() else WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            call.resolve(buildStatus())
        }
    }

    @PluginMethod
    fun runNow(call: PluginCall) {
        val request = OneTimeWorkRequestBuilder<BackgroundHealthWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(TEST_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        call.resolve(JSObject().apply { put("workId", request.id.toString()) })
    }

    @PluginMethod
    fun getPreparedSnapshot(call: PluginCall) {
        val snapshot = BackgroundHealthStore.snapshot(context)
        call.resolve(JSObject().apply { put("snapshot", snapshot) })
    }

    @PluginMethod
    fun acknowledgeRecords(call: PluginCall) {
        BackgroundHealthStore.acknowledgeRecordKeys(context, "sleep", call.stringArray("sleepKeys"))
        BackgroundHealthStore.acknowledgeRecordKeys(context, "workouts", call.stringArray("workoutKeys"))
        call.resolve()
    }

    private suspend fun buildStatus(): JSObject {
        val base = BackgroundHealthStore.status(context)
        val sdkAvailable = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
        var feature = false
        var authorized = false
        if (sdkAvailable) {
            val client = HealthConnectClient.getOrCreate(context)
            feature = featureAvailable(client)
            authorized = feature && client.permissionController.getGrantedPermissions().contains(BACKGROUND_PERMISSION)
        }
        base.put("available", sdkAvailable && feature)
        base.put("authorized", authorized)
        val activityManager = context.getSystemService(ActivityManager::class.java)
        val powerManager = context.getSystemService(PowerManager::class.java)
        base.put("backgroundRestricted", activityManager?.isBackgroundRestricted == true)
        base.put("batteryOptimizationActive", powerManager?.isIgnoringBatteryOptimizations(context.packageName) == false)
        if (base.optBoolean("enabled") && authorized) schedulePeriodic()
        base.put("workerState", if (base.optBoolean("enabled") && authorized) "SCHEDULED" else null)
        return base
    }

    private fun featureAvailable(client: HealthConnectClient): Boolean =
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    private fun clientOrReject(call: PluginCall): HealthConnectClient? {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is unavailable.")
            return null
        }
        return HealthConnectClient.getOrCreate(context)
    }

    private fun schedulePeriodic() {
        val constraints = Constraints.Builder().setRequiresBatteryNotLow(true).build()
        val request = PeriodicWorkRequestBuilder<BackgroundHealthWorker>(1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    private fun PluginCall.stringArray(key: String): List<String> {
        val values = data.optJSONArray(key) ?: return emptyList()
        return (0 until values.length()).mapNotNull { index ->
            values.optString(index).takeIf { it.isNotBlank() }
        }
    }

    private companion object {
        const val BACKGROUND_PERMISSION = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
        const val WORK_NAME = "runmate-background-health-preparation"
        const val TEST_WORK_NAME = "runmate-background-health-test"
    }
}
