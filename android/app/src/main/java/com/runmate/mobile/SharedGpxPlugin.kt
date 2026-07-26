package com.runmate.mobile

import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "SharedGpx")
class SharedGpxPlugin : Plugin() {
    private var pending: SharedGpx? = null

    override fun load() {
        super.load()
        captureIntent(activity.intent, notify = false)
    }

    fun captureIntent(intent: Intent?, notify: Boolean = true) {
        if (intent?.action != Intent.ACTION_SEND) return
        val uri = intent.sharedUri() ?: return
        val text = runCatching {
            context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { reader ->
                val content = reader.readText()
                require(content.toByteArray().size <= MAX_BYTES) { "GPX file is too large." }
                content
            }
        }.getOrNull() ?: return
        pending = SharedGpx(fileName(uri), text)
        intent.removeExtra(Intent.EXTRA_STREAM)
        if (notify) notifyListeners("sharedGpxAvailable", JSObject().apply { put("available", true) })
    }

    @PluginMethod
    fun getPending(call: PluginCall) {
        val value = pending
        pending = null
        call.resolve(JSObject().apply {
            put("available", value != null)
            value?.let {
                put("fileName", it.fileName)
                put("text", it.text)
            }
        })
    }

    private fun fileName(uri: Uri): String {
        var cursor: Cursor? = null
        return try {
            cursor = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            if (cursor?.moveToFirst() == true) cursor.getString(0) else "Samsung Health Route.gpx"
        } catch (_: Exception) {
            "Samsung Health Route.gpx"
        } finally {
            cursor?.close()
        }
    }

    @Suppress("DEPRECATION")
    private fun Intent.sharedUri(): Uri? =
        if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else getParcelableExtra(Intent.EXTRA_STREAM)

    private data class SharedGpx(val fileName: String, val text: String)

    private companion object { const val MAX_BYTES = 5 * 1024 * 1024 }
}
