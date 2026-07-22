package com.runmate.mobile

import android.content.Context
import com.getcapacitor.JSObject

internal object BackgroundHealthStore {
    private const val PREFERENCES = "runmate_background_health"
    private const val ENABLED = "enabled"
    private const val LAST_ATTEMPT = "last_attempt"
    private const val LAST_SUCCESS = "last_success"
    private const val LAST_ERROR = "last_error"
    private const val SNAPSHOT = "snapshot"

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean = preferences(context).getBoolean(ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) {
        preferences(context).edit().putBoolean(ENABLED, enabled).apply()
    }

    fun recordAttempt(context: Context, at: String) {
        preferences(context).edit().putString(LAST_ATTEMPT, at).apply()
    }

    fun recordSuccess(context: Context, at: String, snapshot: JSObject) {
        preferences(context).edit()
            .putString(LAST_SUCCESS, at)
            .remove(LAST_ERROR)
            .putString(SNAPSHOT, snapshot.toString())
            .apply()
    }

    fun recordError(context: Context, message: String) {
        preferences(context).edit().putString(LAST_ERROR, message.take(240)).apply()
    }

    fun snapshot(context: Context): JSObject? {
        val raw = preferences(context).getString(SNAPSHOT, null) ?: return null
        return try { JSObject(raw) } catch (_: Exception) { null }
    }

    fun status(context: Context): JSObject {
        val prefs = preferences(context)
        return JSObject().apply {
            put("enabled", prefs.getBoolean(ENABLED, false))
            put("lastAttemptAt", prefs.getString(LAST_ATTEMPT, null))
            put("lastSuccessAt", prefs.getString(LAST_SUCCESS, null))
            put("lastError", prefs.getString(LAST_ERROR, null))
            put("preparedAt", snapshot(context)?.optString("capturedAt")?.takeIf { it.isNotBlank() })
        }
    }
}
