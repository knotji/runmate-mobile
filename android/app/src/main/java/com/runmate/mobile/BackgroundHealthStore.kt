package com.runmate.mobile

import android.content.Context
import com.getcapacitor.JSObject

internal object BackgroundHealthStore {
    private const val PREFERENCES = "runmate_background_health"
    private const val ENABLED = "enabled"
    private const val LAST_ATTEMPT = "last_attempt"
    private const val LAST_SUCCESS = "last_success"
    private const val LAST_COMPLETED = "last_completed"
    private const val LAST_OUTCOME = "last_outcome"
    private const val LAST_ERROR_CODE = "last_error_code"
    private const val LAST_ERROR = "last_error"
    private const val NEXT_EXPECTED = "next_expected"
    private const val SNAPSHOT = "snapshot"
    private const val ACKNOWLEDGED_SLEEP = "acknowledged_sleep"
    private const val ACKNOWLEDGED_WORKOUTS = "acknowledged_workouts"
    private const val FIRST_SUCCESS_NOTIFIED = "first_success_notified"

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean = preferences(context).getBoolean(ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean, resetNextExpected: Boolean = true) {
        val editor = preferences(context).edit().putBoolean(ENABLED, enabled)
        if (enabled && resetNextExpected) {
            editor.putString(NEXT_EXPECTED, java.time.Instant.now().plusSeconds(3600).toString())
            // A fresh schedule deserves a fresh "it's working" notification the next time it succeeds.
            editor.putBoolean(FIRST_SUCCESS_NOTIFIED, false)
        } else if (!enabled) {
            editor.remove(NEXT_EXPECTED)
        }
        editor.apply()
    }

    /** Returns true only the first time this is called since Background Preparation was (re-)enabled. */
    fun consumeFirstSuccessNotification(context: Context): Boolean {
        val prefs = preferences(context)
        if (prefs.getBoolean(FIRST_SUCCESS_NOTIFIED, false)) return false
        prefs.edit().putBoolean(FIRST_SUCCESS_NOTIFIED, true).apply()
        return true
    }

    fun recordAttempt(context: Context, at: String) {
        val nextExpected = runCatching { java.time.Instant.parse(at).plusSeconds(3600).toString() }.getOrNull()
        preferences(context).edit()
            .putString(LAST_ATTEMPT, at)
            .putString(NEXT_EXPECTED, nextExpected)
            .apply()
    }

    fun recordSuccess(context: Context, at: String, snapshot: JSObject) {
        preferences(context).edit()
            .putString(LAST_SUCCESS, at)
            .putString(LAST_COMPLETED, at)
            .putString(LAST_OUTCOME, "success")
            .remove(LAST_ERROR_CODE)
            .remove(LAST_ERROR)
            .putString(SNAPSHOT, snapshot.toString())
            .apply()
    }

    fun recordError(context: Context, at: String, code: String, message: String) {
        preferences(context).edit()
            .putString(LAST_COMPLETED, at)
            .putString(LAST_OUTCOME, "failed")
            .putString(LAST_ERROR_CODE, code)
            .putString(LAST_ERROR, message.take(240))
            .apply()
    }

    fun snapshot(context: Context): JSObject? {
        val raw = preferences(context).getString(SNAPSHOT, null) ?: return null
        return try { JSObject(raw) } catch (_: Exception) { null }
    }

    fun acknowledgedRecordKeys(context: Context, kind: String): Set<String> =
        preferences(context).getStringSet(acknowledgedKey(kind), emptySet())?.toSet() ?: emptySet()

    fun acknowledgeRecordKeys(context: Context, kind: String, keys: Collection<String>) {
        if (keys.isEmpty()) return
        val merged = acknowledgedRecordKeys(context, kind).toMutableSet()
        merged.addAll(keys.filter { it.isNotBlank() })
        preferences(context).edit().putStringSet(acknowledgedKey(kind), merged).apply()
    }

    fun status(context: Context): JSObject {
        val prefs = preferences(context)
        val prepared = snapshot(context)
        return JSObject().apply {
            put("enabled", prefs.getBoolean(ENABLED, false))
            put("lastAttemptAt", prefs.getString(LAST_ATTEMPT, null))
            put("lastSuccessAt", prefs.getString(LAST_SUCCESS, null))
            put("lastCompletedAt", prefs.getString(LAST_COMPLETED, null))
            put("lastOutcome", prefs.getString(LAST_OUTCOME, null))
            put("lastErrorCode", prefs.getString(LAST_ERROR_CODE, null))
            put("lastError", prefs.getString(LAST_ERROR, null))
            put("preparedAt", prepared?.optString("capturedAt")?.takeIf { it.isNotBlank() })
            put("nextExpectedAt", prefs.getString(NEXT_EXPECTED, null))
            put("windowStart", prepared?.optString("windowStart")?.takeIf { it.isNotBlank() })
            put("windowEnd", prepared?.optString("windowEnd")?.takeIf { it.isNotBlank() })
            put("recordCounts", JSObject().apply {
                put("sleep", prepared.countArray("sleep", "samples"))
                put("workouts", prepared.countArray("workouts", "workouts"))
                put("heartRate", prepared.countArray("heartRate", "samples"))
                put("heartRateVariability", prepared.countArray("heartRateVariability", "samples"))
                put("restingHeartRate", prepared.countArray("restingHeartRate", "samples"))
                put("respiratoryRate", prepared.countArray("respiratoryRate", "samples"))
                put("vo2Max", prepared.countArray("vo2Max", "samples"))
            })
        }
    }

    private fun JSObject?.countArray(objectKey: String, arrayKey: String): Int =
        this?.optJSONObject(objectKey)?.optJSONArray(arrayKey)?.length() ?: 0

    private fun acknowledgedKey(kind: String): String =
        if (kind == "sleep") ACKNOWLEDGED_SLEEP else ACKNOWLEDGED_WORKOUTS
}
