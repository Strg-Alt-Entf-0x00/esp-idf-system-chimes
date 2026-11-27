/**
 * @file system_chimes.c
 * @brief Core system chimes implementation with slot registry
 */

#include "system_chimes.h"
#include "chime_nvs.h"
#include "chime_synth.h"
#include "esp_log.h"
#include "esp_heap_caps.h"
#include "nvs.h"
#include "sdkconfig.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

static const char* TAG = "chimes";

/* Slot registry */
static struct {
    char slot_ids[CHIME_MAX_SLOTS][CHIME_SLOT_ID_MAX_LEN];
    size_t slot_count;
} s_registry = {0};

/* System state */
static struct {
    chime_config_t config;
    bool initialized;
} s_state = {0};

static esp_err_t validate_sound(const chime_sound_t* sound) {
    if (!sound || !sound->slot_id[0] ||
        !memchr(sound->slot_id, '\0', sizeof(sound->slot_id)) ||
        sound->total_duration_ms == 0 ||
        sound->layer_count == 0 || sound->layer_count > CHIME_MAX_LAYERS) {
        return ESP_ERR_INVALID_ARG;
    }

    uint64_t total_samples =
        ((uint64_t)sound->total_duration_ms * s_state.config.sample_rate) / 1000U;
    if (total_samples > UINT32_MAX) {
        return ESP_ERR_INVALID_ARG;
    }

    bool has_note = false;
    for (uint8_t i = 0; i < sound->layer_count; i++) {
        const chime_layer_t* layer = &sound->layers[i];
        if (layer->waveform < CHIME_WAVE_SINE || layer->waveform >= CHIME_WAVE_MAX ||
            !isfinite(layer->volume) || layer->volume < 0.0f || layer->volume > 1.0f ||
            !isfinite(layer->adsr.sustain_level) ||
            layer->adsr.sustain_level < 0.0f || layer->adsr.sustain_level > 1.0f ||
            layer->note_count > CHIME_MAX_NOTES) {
            return ESP_ERR_INVALID_ARG;
        }

        for (uint8_t n = 0; n < layer->note_count; n++) {
            has_note = true;
            const chime_note_t* note = &layer->notes[n];
            uint64_t note_end_ms = (uint64_t)note->start_time_ms + note->duration_ms;
            if (note->duration_ms == 0 || note_end_ms > sound->total_duration_ms ||
                !isfinite(note->frequency_hz) ||
                note->frequency_hz < 20.0f || note->frequency_hz > 20000.0f) {
                return ESP_ERR_INVALID_ARG;
            }
            if (note->frequency_hz > s_state.config.sample_rate / 2.0f) {
                return ESP_ERR_INVALID_ARG;
            }
        }
    }

    return has_note ? ESP_OK : ESP_ERR_INVALID_ARG;
}

static bool is_valid_slot_id(const char* slot_id) {
    for (const char* ch = slot_id; *ch; ch++) {
        if (!((*ch >= 'A' && *ch <= 'Z') ||
              (*ch >= 'a' && *ch <= 'z') ||
              (*ch >= '0' && *ch <= '9') ||
              *ch == '_')) {
            return false;
        }
    }
    return true;
}

/* ========================================================================
 * INITIALIZATION
 * ======================================================================== */

void chime_get_default_config(chime_config_t* config) {
    if (!config) return;
    
    config->sample_rate = CONFIG_CHIMES_DEFAULT_SAMPLE_RATE;
    config->master_volume = CONFIG_CHIMES_DEFAULT_VOLUME / 100.0f;
#ifdef CONFIG_CHIMES_ENABLED_BY_DEFAULT
    config->enabled = true;
#else
    config->enabled = false;
#endif
}

esp_err_t chime_init(const chime_config_t* config) {
    if (s_state.initialized) {
        ESP_LOGW(TAG, "Already initialized");
        return ESP_OK;
    }
    
    if (!config) {
        ESP_LOGE(TAG, "Config is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    if (config->sample_rate == 0 || !isfinite(config->master_volume) ||
        config->master_volume < 0.0f || config->master_volume > 1.0f) {
        ESP_LOGE(TAG, "Invalid chime configuration");
        return ESP_ERR_INVALID_ARG;
    }
    
    // Initialize NVS storage
    esp_err_t ret = chime_nvs_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Store config
    memcpy(&s_state.config, config, sizeof(chime_config_t));
    s_state.initialized = true;
    
    ESP_LOGI(TAG, "Initialized (sample_rate=%lu, volume=%.2f)", 
             config->sample_rate, config->master_volume);
    
    return ESP_OK;
}

esp_err_t chime_get_storage_info(chime_storage_info_t* info) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!info) {
        return ESP_ERR_INVALID_ARG;
    }

    nvs_stats_t stats;
    esp_err_t ret = nvs_get_stats(NULL, &stats);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read NVS storage statistics: %s",
                 esp_err_to_name(ret));
        return ret;
    }

    info->nvs_used_entries = stats.used_entries;
    info->nvs_free_entries = stats.free_entries;
    info->nvs_available_entries = stats.available_entries;
    info->nvs_total_entries = stats.total_entries;
    info->nvs_namespace_count = stats.namespace_count;
    info->heap_free_bytes = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    info->heap_largest_free_block_bytes =
        heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    return ESP_OK;
}

esp_err_t chime_deinit(void) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    chime_nvs_deinit();
    
    // Clear registry
    memset(&s_registry, 0, sizeof(s_registry));
    
    s_state.initialized = false;
    ESP_LOGI(TAG, "Deinitialized");
    
    return ESP_OK;
}

/* ========================================================================
 * SLOT MANAGEMENT
 * ======================================================================== */

esp_err_t chime_register_slot(const char* slot_id) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!slot_id || !slot_id[0]) {
        ESP_LOGE(TAG, "Invalid slot_id");
        return ESP_ERR_INVALID_ARG;
    }
    
    size_t len = strlen(slot_id);
    if (len > CHIME_SLOT_ID_MAX_CHARS) {
        ESP_LOGE(TAG, "Slot ID '%s' too long (%d, max %d)", 
                 slot_id, (int)len, CHIME_SLOT_ID_MAX_CHARS);
        return ESP_ERR_INVALID_ARG;
    }

    if (!is_valid_slot_id(slot_id)) {
        ESP_LOGE(TAG, "Slot ID contains unsupported characters");
        return ESP_ERR_INVALID_ARG;
    }
    
    // Check if already registered
    for (size_t i = 0; i < s_registry.slot_count; i++) {
        if (strcmp(s_registry.slot_ids[i], slot_id) == 0) {
            ESP_LOGD(TAG, "Slot '%s' already registered", slot_id);
            return ESP_OK;
        }
    }
    
    // Check slot limit
    if (s_registry.slot_count >= CHIME_MAX_SLOTS) {
        ESP_LOGE(TAG, "Slot limit reached (%d)", CHIME_MAX_SLOTS);
        return ESP_ERR_NO_MEM;
    }
    
    // Add to registry
    strncpy(s_registry.slot_ids[s_registry.slot_count], slot_id, 
            CHIME_SLOT_ID_MAX_LEN - 1);
    s_registry.slot_ids[s_registry.slot_count][CHIME_SLOT_ID_MAX_LEN - 1] = '\0';
    s_registry.slot_count++;
    
    ESP_LOGI(TAG, "Registered slot '%s' (%d/%d)", 
             slot_id, s_registry.slot_count, CHIME_MAX_SLOTS);
    
    return ESP_OK;
}

esp_err_t chime_get_slots(chime_slot_info_t* slots, size_t max_slots, size_t* slot_count) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!slots || !slot_count) {
        return ESP_ERR_INVALID_ARG;
    }
    *slot_count = 0;
    
    size_t count = (s_registry.slot_count < max_slots) ? 
                   s_registry.slot_count : max_slots;
    
    for (size_t i = 0; i < count; i++) {
        strncpy(slots[i].slot_id, s_registry.slot_ids[i], CHIME_SLOT_ID_MAX_LEN);
        slots[i].slot_id[CHIME_SLOT_ID_MAX_LEN - 1] = '\0';
        
        // Check if sound exists
        esp_err_t ret = chime_nvs_exists(slots[i].slot_id, &slots[i].has_sound);
        if (ret != ESP_OK) {
            return ret;
        }
        
        // Load duration if exists
        if (slots[i].has_sound) {
            chime_sound_t* sound = malloc(sizeof(*sound));
            if (!sound) {
                return ESP_ERR_NO_MEM;
            }

            ret = chime_load_sound(slots[i].slot_id, sound);
            if (ret != ESP_OK) {
                free(sound);
                return ret;
            }

            slots[i].duration_ms = sound->total_duration_ms;
            free(sound);
        } else {
            slots[i].duration_ms = 0;
        }
    }
    
    *slot_count = count;
    return ESP_OK;
}

bool chime_slot_exists(const char* slot_id) {
    if (!slot_id) return false;
    
    for (size_t i = 0; i < s_registry.slot_count; i++) {
        if (strcmp(s_registry.slot_ids[i], slot_id) == 0) {
            return true;
        }
    }
    
    return false;
}

/* ========================================================================
 * SOUND DATA MANAGEMENT
 * ======================================================================== */

esp_err_t chime_save_sound(const chime_sound_t* sound) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    // Check if slot is registered
    esp_err_t ret = validate_sound(sound);
    if (ret != ESP_OK) {
        return ret;
    }

    if (!chime_slot_exists(sound->slot_id)) {
        ESP_LOGE(TAG, "Slot '%s' not registered", sound->slot_id);
        return ESP_ERR_NOT_FOUND;
    }
    
    // Save to NVS
    return chime_nvs_save(sound);
}

esp_err_t chime_load_sound(const char* slot_id, chime_sound_t* sound) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!slot_id || !sound) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret = chime_nvs_load(slot_id, sound);
    if (ret != ESP_OK) {
        return ret;
    }

    if (!memchr(sound->slot_id, '\0', sizeof(sound->slot_id)) ||
        strcmp(sound->slot_id, slot_id) != 0 ||
        validate_sound(sound) != ESP_OK) {
        ESP_LOGE(TAG, "Invalid sound data stored for slot '%s'", slot_id);
        return ESP_ERR_INVALID_RESPONSE;
    }

    return ESP_OK;
}

esp_err_t chime_delete_sound(const char* slot_id) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!slot_id) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!chime_slot_exists(slot_id)) {
        return ESP_ERR_NOT_FOUND;
    }
    
    return chime_nvs_delete(slot_id);
}

esp_err_t chime_erase_all_sounds(void) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    return chime_nvs_erase_all();
}

esp_err_t chime_has_sound(const char* slot_id, bool* has_sound) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!slot_id || !has_sound) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!chime_slot_exists(slot_id)) {
        return ESP_ERR_NOT_FOUND;
    }
    return chime_nvs_exists(slot_id, has_sound);
}

/* ========================================================================
 * PLAYBACK
 * ======================================================================== */

esp_err_t chime_play(const char* slot_id, chime_handle_t* handle) {
    if (handle) {
        *handle = NULL;
    }

    if (!s_state.initialized) {
        ESP_LOGE(TAG, "Not initialized");
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!s_state.config.enabled) {
        ESP_LOGD(TAG, "Chimes disabled");
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!slot_id || !handle) {
        ESP_LOGE(TAG, "Invalid arguments");
        return ESP_ERR_INVALID_ARG;
    }
    
    // Check if slot registered
    if (!chime_slot_exists(slot_id)) {
        ESP_LOGE(TAG, "Slot '%s' not registered", slot_id);
        return ESP_ERR_NOT_FOUND;
    }
    
    // Load sound from NVS
    chime_sound_t* sound = malloc(sizeof(*sound));
    if (!sound) {
        return ESP_ERR_NO_MEM;
    }

    esp_err_t ret = chime_load_sound(slot_id, sound);
    if (ret != ESP_OK) {
        free(sound);
        ESP_LOGE(TAG, "No sound data for slot '%s'", slot_id);
        return ret;
    }
    
    ret = chime_play_sound(sound, handle);
    free(sound);
    return ret;
}

esp_err_t chime_play_sound(const chime_sound_t* sound, chime_handle_t* handle) {
    if (!s_state.initialized) {
        ESP_LOGE(TAG, "Not initialized");
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!s_state.config.enabled) {
        ESP_LOGD(TAG, "Chimes disabled");
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!sound || !handle) {
        ESP_LOGE(TAG, "Invalid arguments");
        return ESP_ERR_INVALID_ARG;
    }

    esp_err_t ret = chime_synth_create(sound, s_state.config.sample_rate, 
                                       s_state.config.master_volume, handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create synthesizer: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "Playing sound '%s' (%lu ms, %d layers)", 
             sound->slot_id, (unsigned long)sound->total_duration_ms, sound->layer_count);
    return ESP_OK;
}

esp_err_t chime_render(chime_handle_t handle, int16_t* buffer, 
                       size_t buffer_size, size_t* samples_rendered) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!handle || !buffer) {
        return ESP_ERR_INVALID_ARG;
    }
    
    return chime_synth_render(handle, buffer, buffer_size, samples_rendered);
}

bool chime_is_finished(chime_handle_t handle) {
    if (!handle) return true;
    return chime_synth_is_finished(handle);
}

esp_err_t chime_stop(chime_handle_t handle) {
    if (!handle) {
        return ESP_ERR_INVALID_ARG;
    }
    
    return chime_synth_destroy(handle);
}

/* ========================================================================
 * GLOBAL SETTINGS
 * ======================================================================== */

esp_err_t chime_set_volume(float volume) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!isfinite(volume) || volume < 0.0f || volume > 1.0f) {
        return ESP_ERR_INVALID_ARG;
    }
    
    s_state.config.master_volume = volume;
    ESP_LOGI(TAG, "Volume: %.2f", volume);
    
    return ESP_OK;
}

float chime_get_volume(void) {
    return s_state.config.master_volume;
}

esp_err_t chime_set_enabled(bool enabled) {
    if (!s_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    s_state.config.enabled = enabled;
    ESP_LOGI(TAG, "Chimes %s", enabled ? "enabled" : "disabled");
    
    return ESP_OK;
}

bool chime_is_enabled(void) {
    return s_state.config.enabled;
}
