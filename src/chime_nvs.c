/**
 * @file chime_nvs.c
 * @brief NVS storage implementation for chime sounds
 */

#include "chime_nvs.h"
#include "nvs.h"
#include "esp_log.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

static const char* TAG = "chime_nvs";
static const char* NVS_NAMESPACE = "chimes_v1";

#define STORAGE_FORMAT_VERSION 1
#define STORAGE_HEADER_SIZE 6
#define STORAGE_LAYER_HEADER_SIZE 16
#define STORAGE_NOTE_SIZE 12
#define STORAGE_MAX_SIZE \
    (STORAGE_HEADER_SIZE + CHIME_MAX_LAYERS * STORAGE_LAYER_HEADER_SIZE + \
     CHIME_MAX_LAYERS * CHIME_MAX_NOTES * STORAGE_NOTE_SIZE)

static struct {
    nvs_handle_t handle;
    bool initialized;
} s_nvs_state = {0};

static void write_u16(uint8_t** output, uint16_t value) {
    *(*output)++ = (uint8_t)value;
    *(*output)++ = (uint8_t)(value >> 8);
}

static void write_u32(uint8_t** output, uint32_t value) {
    for (unsigned int i = 0; i < 4; ++i) {
        *(*output)++ = (uint8_t)(value >> (i * 8));
    }
}

static void write_float(uint8_t** output, float value) {
    uint32_t bits;
    memcpy(&bits, &value, sizeof(bits));
    write_u32(output, bits);
}

static uint16_t read_u16(const uint8_t** input) {
    const uint16_t value = (uint16_t)(*input)[0] |
                           ((uint16_t)(*input)[1] << 8);
    *input += 2;
    return value;
}

static uint32_t read_u32(const uint8_t** input) {
    uint32_t value = 0;
    for (unsigned int i = 0; i < 4; ++i) {
        value |= (uint32_t)(*input)[i] << (i * 8);
    }
    *input += 4;
    return value;
}

static float read_float(const uint8_t** input) {
    const uint32_t bits = read_u32(input);
    float value;
    memcpy(&value, &bits, sizeof(value));
    return value;
}

static size_t serialized_size(const chime_sound_t* sound) {
    size_t size = STORAGE_HEADER_SIZE;
    for (uint8_t i = 0; i < sound->layer_count; ++i) {
        size += STORAGE_LAYER_HEADER_SIZE +
                (size_t)sound->layers[i].note_count * STORAGE_NOTE_SIZE;
    }
    return size;
}

static esp_err_t serialize_sound(const chime_sound_t* sound,
                                 uint8_t* output,
                                 size_t output_size) {
    const size_t required_size = serialized_size(sound);
    if (required_size > output_size) {
        return ESP_ERR_INVALID_SIZE;
    }

    uint8_t* cursor = output;
    *cursor++ = STORAGE_FORMAT_VERSION;
    *cursor++ = sound->layer_count;
    write_u32(&cursor, sound->total_duration_ms);

    for (uint8_t i = 0; i < sound->layer_count; ++i) {
        const chime_layer_t* layer = &sound->layers[i];
        *cursor++ = (uint8_t)layer->waveform;
        write_float(&cursor, layer->volume);
        write_u16(&cursor, layer->adsr.attack_ms);
        write_u16(&cursor, layer->adsr.decay_ms);
        write_float(&cursor, layer->adsr.sustain_level);
        write_u16(&cursor, layer->adsr.release_ms);
        *cursor++ = layer->note_count;

        for (uint8_t n = 0; n < layer->note_count; ++n) {
            const chime_note_t* note = &layer->notes[n];
            write_u32(&cursor, note->start_time_ms);
            write_u32(&cursor, note->duration_ms);
            write_float(&cursor, note->frequency_hz);
        }
    }

    return cursor - output == (ptrdiff_t)required_size
        ? ESP_OK
        : ESP_ERR_INVALID_SIZE;
}

static esp_err_t deserialize_sound(const char* slot_id,
                                   const uint8_t* input,
                                   size_t input_size,
                                   chime_sound_t* sound) {
    if (input_size < STORAGE_HEADER_SIZE || input_size > STORAGE_MAX_SIZE) {
        return ESP_ERR_INVALID_SIZE;
    }
    if (slot_id == NULL || sound == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    const size_t slot_id_length = strnlen(slot_id, CHIME_SLOT_ID_MAX_LEN);
    if (slot_id_length == 0 || slot_id_length >= CHIME_SLOT_ID_MAX_LEN) {
        return ESP_ERR_INVALID_ARG;
    }
    if (input[0] != STORAGE_FORMAT_VERSION ||
        input[1] == 0 || input[1] > CHIME_MAX_LAYERS) {
        return ESP_ERR_INVALID_RESPONSE;
    }

    memset(sound, 0, sizeof(*sound));
    memcpy(sound->slot_id, slot_id, slot_id_length + 1);
    const uint8_t* cursor = input + 2;
    sound->layer_count = input[1];
    sound->total_duration_ms = read_u32(&cursor);

    for (uint8_t i = 0; i < sound->layer_count; ++i) {
        if ((size_t)(cursor - input) + STORAGE_LAYER_HEADER_SIZE > input_size) {
            return ESP_ERR_INVALID_SIZE;
        }
        chime_layer_t* layer = &sound->layers[i];
        layer->waveform = (chime_waveform_t)*cursor++;
        layer->volume = read_float(&cursor);
        layer->adsr.attack_ms = read_u16(&cursor);
        layer->adsr.decay_ms = read_u16(&cursor);
        layer->adsr.sustain_level = read_float(&cursor);
        layer->adsr.release_ms = read_u16(&cursor);
        layer->note_count = *cursor++;
        if (layer->note_count > CHIME_MAX_NOTES ||
            (size_t)(cursor - input) +
                (size_t)layer->note_count * STORAGE_NOTE_SIZE > input_size) {
            return ESP_ERR_INVALID_SIZE;
        }

        for (uint8_t n = 0; n < layer->note_count; ++n) {
            chime_note_t* note = &layer->notes[n];
            note->start_time_ms = read_u32(&cursor);
            note->duration_ms = read_u32(&cursor);
            note->frequency_hz = read_float(&cursor);
            if (!isfinite(note->frequency_hz)) {
                return ESP_ERR_INVALID_RESPONSE;
            }
        }
    }

    return (size_t)(cursor - input) == input_size
        ? ESP_OK
        : ESP_ERR_INVALID_SIZE;
}

esp_err_t chime_nvs_init(void) {
    if (s_nvs_state.initialized) {
        ESP_LOGW(TAG, "Already initialized");
        return ESP_OK;
    }
    
    esp_err_t ret = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &s_nvs_state.handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace: %s", esp_err_to_name(ret));
        return ret;
    }
    
    s_nvs_state.initialized = true;
    ESP_LOGI(TAG, "Initialized (namespace: %s)", NVS_NAMESPACE);
    
    return ESP_OK;
}

esp_err_t chime_nvs_deinit(void) {
    if (!s_nvs_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    nvs_close(s_nvs_state.handle);
    s_nvs_state.initialized = false;
    
    ESP_LOGI(TAG, "Deinitialized");
    return ESP_OK;
}

esp_err_t chime_nvs_save(const chime_sound_t* sound) {
    if (!s_nvs_state.initialized) {
        ESP_LOGE(TAG, "Not initialized");
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!sound || !sound->slot_id[0]) {
        ESP_LOGE(TAG, "Invalid sound or slot_id");
        return ESP_ERR_INVALID_ARG;
    }
    
    const size_t blob_size = serialized_size(sound);
    uint8_t* blob = malloc(blob_size);
    if (!blob) {
        return ESP_ERR_NO_MEM;
    }
    esp_err_t ret = serialize_sound(sound, blob, blob_size);
    if (ret != ESP_OK) {
        free(blob);
        return ret;
    }

    nvs_stats_t stats;
    ret = nvs_get_stats(NULL, &stats);
    if (ret != ESP_OK) {
        free(blob);
        ESP_LOGE(TAG, "Failed to inspect NVS capacity: %s", esp_err_to_name(ret));
        return ret;
    }
    ESP_LOGI(TAG, "Saving '%s' (%u bytes); default NVS has %u available entries",
             sound->slot_id, (unsigned)blob_size, (unsigned)stats.available_entries);

    ret = nvs_set_blob(s_nvs_state.handle, sound->slot_id, blob, blob_size);
    if (ret != ESP_OK) {
        free(blob);
        ESP_LOGE(TAG, "Failed to save sound '%s': %s",
                 sound->slot_id, esp_err_to_name(ret));
        return ret;
    }
    free(blob);
    
    // Commit changes
    ret = nvs_commit(s_nvs_state.handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "Saved sound '%s' (%lu ms, %d layers)", 
             sound->slot_id, sound->total_duration_ms, sound->layer_count);
    
    return ESP_OK;
}

esp_err_t chime_nvs_load(const char* slot_id, chime_sound_t* sound) {
    if (!s_nvs_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!slot_id || !sound) {
        return ESP_ERR_INVALID_ARG;
    }
    
    size_t required_size = 0;
    esp_err_t ret = nvs_get_blob(s_nvs_state.handle, slot_id, NULL, &required_size);
    
    if (ret == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGD(TAG, "Sound '%s' not found in NVS", slot_id);
        return ESP_ERR_NOT_FOUND;
    }
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load sound '%s': %s", 
                 slot_id, esp_err_to_name(ret));
        return ret;
    }

    if (required_size < STORAGE_HEADER_SIZE || required_size > STORAGE_MAX_SIZE) {
        ESP_LOGE(TAG, "Invalid stored sound size for '%s': %u", slot_id,
                 (unsigned)required_size);
        return ESP_ERR_INVALID_SIZE;
    }

    uint8_t* blob = malloc(required_size);
    if (!blob) {
        return ESP_ERR_NO_MEM;
    }
    ret = nvs_get_blob(s_nvs_state.handle, slot_id, blob, &required_size);
    if (ret != ESP_OK) {
        free(blob);
        ESP_LOGE(TAG, "Failed to read sound '%s': %s",
                 slot_id, esp_err_to_name(ret));
        return ret;
    }
    ret = deserialize_sound(slot_id, blob, required_size, sound);
    free(blob);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Invalid stored sound data for '%s': %s",
                 slot_id, esp_err_to_name(ret));
        return ret;
    }

    ESP_LOGD(TAG, "Loaded sound '%s' (%lu ms, %d layers)", 
             sound->slot_id, sound->total_duration_ms, sound->layer_count);
    
    return ESP_OK;
}

esp_err_t chime_nvs_exists(const char* slot_id, bool* exists) {
    if (!s_nvs_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!slot_id || !exists) {
        return ESP_ERR_INVALID_ARG;
    }

    *exists = false;
    size_t required_size = 0;
    esp_err_t ret = nvs_get_blob(s_nvs_state.handle, slot_id, 
                                  NULL, &required_size);
    if (ret == ESP_ERR_NVS_NOT_FOUND) {
        return ESP_OK;
    }
    if (ret != ESP_OK) {
        return ret;
    }
    *exists = required_size > 0;
    return ESP_OK;
}

esp_err_t chime_nvs_delete(const char* slot_id) {
    if (!s_nvs_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (!slot_id) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret = nvs_erase_key(s_nvs_state.handle, slot_id);
    if (ret != ESP_OK && ret != ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGE(TAG, "Failed to delete sound '%s': %s", 
                 slot_id, esp_err_to_name(ret));
        return ret;
    }
    
    ret = nvs_commit(s_nvs_state.handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "Deleted sound '%s'", slot_id);
    return ESP_OK;
}

esp_err_t chime_nvs_erase_all(void) {
    if (!s_nvs_state.initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t ret = nvs_erase_all(s_nvs_state.handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase chime namespace: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = nvs_commit(s_nvs_state.handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit namespace erase: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "Erased all sounds from namespace '%s'", NVS_NAMESPACE);
    return ESP_OK;
}
