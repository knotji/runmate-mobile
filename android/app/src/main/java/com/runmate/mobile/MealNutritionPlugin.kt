package com.runmate.mobile

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * `@capgo/capacitor-health`'s `saveSample()` only writes a single scalar value per call and
 * has no protein/carbs/fat fields — the limitation is in that plugin's API surface, not in
 * Health Connect itself. `NutritionRecord` natively supports macros, and the write permission
 * Health Connect grants (`android.permission.health.WRITE_NUTRITION`, requested for
 * `dietaryEnergyConsumed` in `nutritionSync.ts`) is scoped to the whole `NutritionRecord`
 * type, not per nutrient — so no additional permission is required for this plugin.
 */
@CapacitorPlugin(name = "MealNutrition")
class MealNutritionPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun saveMealNutrition(call: PluginCall) {
        val caloriesKcal = call.getDouble("caloriesKcal")
        val proteinG = call.getDouble("proteinG")
        val carbsG = call.getDouble("carbsG")
        val fatG = call.getDouble("fatG")
        if (caloriesKcal == null && proteinG == null && carbsG == null && fatG == null) {
            call.reject("At least one nutrition value is required")
            return
        }

        val startTime = try {
            Instant.parse(call.getString("startDate"))
        } catch (e: Exception) {
            call.reject("Invalid or missing startDate", null, e)
            return
        }
        val endTime = try {
            Instant.parse(call.getString("endDate"))
        } catch (e: Exception) {
            call.reject("Invalid or missing endDate", null, e)
            return
        }

        // Both optional: an absent/blank name renders as a generic "Nutrition" entry in
        // Samsung Health, and an unrecognized/missing mealType falls back to unknown —
        // neither blocks the write, since the macros are the primary payload.
        val name = call.getString("name")?.takeIf { it.isNotBlank() }
        val mealType = call.getString("mealType")?.let { MealType.MEAL_TYPE_STRING_TO_INT_MAP[it] } ?: MealType.MEAL_TYPE_UNKNOWN

        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is unavailable.")
            return
        }
        val client = HealthConnectClient.getOrCreate(context)

        scope.launch {
            try {
                val record = NutritionRecord(
                    startTime = startTime,
                    startZoneOffset = ZoneId.systemDefault().rules.getOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = ZoneId.systemDefault().rules.getOffset(endTime),
                    energy = caloriesKcal?.let { Energy.kilocalories(it) },
                    protein = proteinG?.let { Mass.grams(it) },
                    totalCarbohydrate = carbsG?.let { Mass.grams(it) },
                    totalFat = fatG?.let { Mass.grams(it) },
                    name = name,
                    mealType = mealType,
                    metadata = Metadata.manualEntry(),
                )
                val response = client.insertRecords(listOf(record))
                val recordId = response.recordIdsList.firstOrNull()
                if (recordId == null) {
                    call.reject("Health Connect did not return a record ID for the new Nutrition record.")
                    return@launch
                }
                call.resolve(JSObject().apply { put("recordId", recordId) })
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to save meal nutrition.", null, e)
            }
        }
    }

    /**
     * Best-effort cleanup so a meal deleted in RunMate does not leave an orphaned Nutrition
     * record behind in Health Connect (and therefore in Samsung Health, which reads from it).
     * `recordId` is the ID `saveMealNutrition` returned when the record was first written;
     * RunMate persists it on the corresponding history item for exactly this purpose.
     */
    @PluginMethod
    fun deleteMealNutrition(call: PluginCall) {
        val recordId = call.getString("recordId")
        if (recordId.isNullOrBlank()) {
            call.reject("recordId is required")
            return
        }
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is unavailable.")
            return
        }
        val client = HealthConnectClient.getOrCreate(context)
        scope.launch {
            try {
                client.deleteRecords(NutritionRecord::class, listOf(recordId), emptyList())
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to delete meal nutrition.", null, e)
            }
        }
    }
}
