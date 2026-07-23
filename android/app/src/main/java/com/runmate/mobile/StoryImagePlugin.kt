package com.runmate.mobile

import android.content.ContentValues
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "StoryImage")
class StoryImagePlugin : Plugin() {
    @PluginMethod
    fun save(call: PluginCall) {
        val dataUrl = call.getString("dataUrl")
        val requestedName = call.getString("fileName")
        if (dataUrl.isNullOrBlank() || requestedName.isNullOrBlank()) {
            call.reject("Image data and file name are required.")
            return
        }

        val fileName = sanitizeFileName(requestedName)
        val encoded = dataUrl.substringAfter(',', "")
        if (encoded.isBlank()) {
            call.reject("Image data is invalid.")
            return
        }

        val bytes = try {
            Base64.decode(encoded, Base64.DEFAULT)
        } catch (error: IllegalArgumentException) {
            call.reject("Image data could not be decoded.", error)
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveWithMediaStore(call, fileName, bytes)
            } else {
                saveLegacy(call, fileName, bytes)
            }
        } catch (error: Exception) {
            call.reject("Image could not be saved.", error)
        }
    }

    private fun saveWithMediaStore(call: PluginCall, fileName: String, bytes: ByteArray) {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/RunMate")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Android did not create an image destination.")
        try {
            resolver.openOutputStream(uri)?.use { output -> output.write(bytes) }
                ?: throw IllegalStateException("Android did not open the image destination.")
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            call.resolve(result(uri.toString(), fileName))
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            throw error
        }
    }

    @Suppress("DEPRECATION")
    private fun saveLegacy(call: PluginCall, fileName: String, bytes: ByteArray) {
        val root = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: throw IllegalStateException("Pictures storage is unavailable.")
        val directory = File(root, "RunMate").apply { mkdirs() }
        val file = File(directory, fileName)
        FileOutputStream(file).use { output -> output.write(bytes) }
        MediaScannerConnection.scanFile(
            context,
            arrayOf(file.absolutePath),
            arrayOf("image/png"),
        ) { _, uri ->
            activity.runOnUiThread {
                call.resolve(result(uri?.toString() ?: file.toURI().toString(), fileName))
            }
        }
    }

    private fun result(uri: String, fileName: String) = JSObject().apply {
        put("uri", uri)
        put("fileName", fileName)
    }

    private fun sanitizeFileName(value: String): String {
        val base = value.replace(Regex("[^A-Za-z0-9._-]"), "-").take(96)
        return if (base.lowercase().endsWith(".png")) base else "$base.png"
    }
}
