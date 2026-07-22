package com.runmate.mobile

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

internal object BackgroundHealthNotifier {
    private const val CHANNEL_ID = "runmate-guidance"
    private const val SAMSUNG_HEALTH_SOURCE_ID = "com.sec.android.app.shealth"
    private const val SLEEP_NOTIFICATION_ID = 42001
    private const val WORKOUT_NOTIFICATION_ID = 42002
    private const val COMBINED_NOTIFICATION_ID = 42003

    fun notifyNewRecords(context: Context, previous: JSObject?, current: JSObject) {
        val currentSleep = current.records("sleep", "samples").samsungRecords()
        val currentWorkouts = current.records("workouts", "workouts").samsungRecords()
        val currentSleepKeys = currentSleep.map(::recordKey)
        val currentWorkoutKeys = currentWorkouts.map(::recordKey)

        // The first successful preparation establishes a baseline. Historical records from
        // the initial 36-hour read should not look like newly-arrived health data.
        if (previous == null) {
            acknowledge(context, currentSleepKeys, currentWorkoutKeys)
            return
        }

        val newSleep = newRecords(
            previous.records("sleep", "samples").samsungRecords(),
            currentSleep,
            BackgroundHealthStore.acknowledgedRecordKeys(context, "sleep"),
        )
        val newWorkouts = newRecords(
            previous.records("workouts", "workouts").samsungRecords(),
            currentWorkouts,
            BackgroundHealthStore.acknowledgedRecordKeys(context, "workouts"),
        )

        if (notificationsAllowed(context)) {
            ensureChannel(context)
            when {
                newSleep.isNotEmpty() && newWorkouts.isNotEmpty() -> post(
                    context,
                    COMBINED_NOTIFICATION_ID,
                    "New Health Data Is Ready",
                    "${countLabel(newSleep.size, "Sleep record")} and ${countLabel(newWorkouts.size, "Workout")} arrived from Samsung Health.",
                    "/tabs/recovery",
                )
                newSleep.isNotEmpty() -> post(
                    context,
                    SLEEP_NOTIFICATION_ID,
                    "Sleep Data Is Ready",
                    "New Sleep data arrived from Samsung Health. Open RunMate to refresh Recovery.",
                    "/tabs/recovery",
                )
                newWorkouts.isNotEmpty() -> post(
                    context,
                    WORKOUT_NOTIFICATION_ID,
                    "Workout Data Is Ready",
                    workoutMessage(newWorkouts),
                    "/tabs/activity",
                )
            }
        }
        // Do not surface stale arrivals later if notification access was disabled. Foreground
        // sync also writes to this acknowledgement store to prevent late duplicate alerts.
        acknowledge(context, currentSleepKeys, currentWorkoutKeys)
    }

    private fun newRecords(previous: List<JSONObject>, current: List<JSONObject>, acknowledged: Set<String>): List<JSONObject> {
        val previousKeys = previous.map(::recordKey).toSet()
        return current.filter { recordKey(it) !in previousKeys && recordKey(it) !in acknowledged }
    }

    private fun List<JSONObject>.samsungRecords(): List<JSONObject> =
        filter { it.optString("sourceId") == SAMSUNG_HEALTH_SOURCE_ID }

    private fun acknowledge(context: Context, sleepKeys: List<String>, workoutKeys: List<String>) {
        BackgroundHealthStore.acknowledgeRecordKeys(context, "sleep", sleepKeys)
        BackgroundHealthStore.acknowledgeRecordKeys(context, "workouts", workoutKeys)
    }

    private fun recordKey(record: JSONObject): String {
        val platformId = record.optString("platformId").trim()
        if (platformId.isNotBlank()) return platformId
        return listOf(
            record.optString("sourceId"),
            record.optString("startDate"),
            record.optString("endDate"),
            record.optString("workoutType"),
        ).joinToString("|")
    }

    private fun workoutMessage(records: List<JSONObject>): String {
        if (records.size != 1) return "${records.size} new Workouts arrived from Samsung Health."
        val record = records.first()
        val type = record.optString("workoutType").toWorkoutLabel()
        val durationMinutes = (record.optDouble("duration", 0.0) / 60.0).toInt()
        return if (durationMinutes > 0) "$type - $durationMinutes min arrived from Samsung Health."
        else "$type arrived from Samsung Health."
    }

    private fun post(context: Context, id: Int, title: String, body: String, route: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.Builder()
                .scheme("com.runmate.mobile")
                .authority("navigate")
                .appendQueryParameter("route", route)
                .build()
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.runmate.mobile.R.drawable.ic_stat_runmate)
            .setColor(Color.rgb(47, 148, 208))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(id, notification)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "RunMate Guidance", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Sleep, Workout, and Recovery guidance"
            },
        )
    }

    private fun notificationsAllowed(context: Context): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    private fun JSObject.records(objectKey: String, arrayKey: String): List<JSONObject> {
        val array = optJSONObject(objectKey)?.optJSONArray(arrayKey) ?: JSONArray()
        return (0 until array.length()).mapNotNull(array::optJSONObject)
    }

    private fun countLabel(count: Int, noun: String): String = "$count $noun${if (count == 1) "" else "s"}"

    private fun String.toWorkoutLabel(): String {
        if (isBlank()) return "Workout"
        return replace(Regex("([a-z])([A-Z])"), "\$1 \$2")
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}
