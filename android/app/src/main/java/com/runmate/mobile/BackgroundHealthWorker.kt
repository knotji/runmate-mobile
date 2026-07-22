package com.runmate.mobile

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.capgo.plugin.health.HealthDataType
import app.capgo.plugin.health.HealthManager
import com.getcapacitor.JSObject
import java.time.Duration
import java.time.Instant

class BackgroundHealthWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val capturedAt = Instant.now()
        val previousSnapshot = BackgroundHealthStore.snapshot(applicationContext)
        BackgroundHealthStore.recordAttempt(applicationContext, capturedAt.toString())
        if (!BackgroundHealthStore.isEnabled(applicationContext)) return Result.success()

        return try {
            if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
                BackgroundHealthStore.recordError(applicationContext, capturedAt.toString(), "health_connect_unavailable", "Health Connect is unavailable.")
                return Result.success()
            }

            val client = HealthConnectClient.getOrCreate(applicationContext)
            val granted = client.permissionController.getGrantedPermissions()
            if (!granted.contains(BACKGROUND_PERMISSION)) {
                BackgroundHealthStore.recordError(applicationContext, capturedAt.toString(), "background_access_missing", "Background Health access is not allowed.")
                return Result.success()
            }

            val manager = HealthManager()
            val start = capturedAt.minus(Duration.ofHours(36))
            val payload = JSObject().apply {
                put("capturedAt", capturedAt.toString())
                put("windowStart", start.toString())
                put("windowEnd", capturedAt.toString())
            }

            if (granted.contains(HealthDataType.SLEEP.readPermission)) {
                payload.put("sleep", manager.readSamples(client, HealthDataType.SLEEP, start, capturedAt, 100, true))
            }
            putSamplesWhenAllowed(payload, "heartRate", HealthDataType.HEART_RATE, granted, manager, client, start, capturedAt, 2500)
            putSamplesWhenAllowed(payload, "heartRateVariability", HealthDataType.HEART_RATE_VARIABILITY, granted, manager, client, start, capturedAt, 200)
            putSamplesWhenAllowed(payload, "restingHeartRate", HealthDataType.RESTING_HEART_RATE, granted, manager, client, start, capturedAt, 200)
            putSamplesWhenAllowed(payload, "respiratoryRate", HealthDataType.RESPIRATORY_RATE, granted, manager, client, start, capturedAt, 200)
            putSamplesWhenAllowed(payload, "vo2Max", HealthDataType.VO2_MAX, granted, manager, client, start, capturedAt, 200)

            val workoutPermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
            if (granted.contains(workoutPermission)) {
                payload.put("workouts", manager.queryWorkouts(client, null, start, capturedAt, 200, true, null))
            }

            BackgroundHealthStore.recordSuccess(applicationContext, capturedAt.toString(), payload)
            runCatching {
                BackgroundHealthNotifier.notifyNewRecords(applicationContext, previousSnapshot, payload)
            }
            Result.success()
        } catch (error: SecurityException) {
            BackgroundHealthStore.recordError(applicationContext, capturedAt.toString(), "permission_changed", error.message ?: "Health Connect permission changed.")
            Result.success()
        } catch (error: Exception) {
            BackgroundHealthStore.recordError(applicationContext, capturedAt.toString(), "worker_failed", error.message ?: "Background Health preparation failed.")
            if (runAttemptCount < 2) Result.retry() else Result.failure()
        }
    }

    private suspend fun putSamplesWhenAllowed(
        payload: JSObject,
        key: String,
        type: HealthDataType,
        granted: Set<String>,
        manager: HealthManager,
        client: HealthConnectClient,
        start: Instant,
        end: Instant,
        limit: Int,
    ) {
        if (granted.contains(type.readPermission)) {
            payload.put(key, manager.readSamples(client, type, start, end, limit, true))
        }
    }

    private companion object {
        const val BACKGROUND_PERMISSION = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
    }
}
