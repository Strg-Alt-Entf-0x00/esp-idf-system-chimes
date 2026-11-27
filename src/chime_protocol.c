/**
 * @file chime_protocol.c
 * @brief Serial protocol implementation
 */

#include "chime_protocol.h"
#include "system_chimes.h"
#include "cJSON.h"
#include <errno.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

/* Playback state for PLAY command */
static struct {
    chime_handle_t handle;
    bool active;
} s_playback = {0};
static SemaphoreHandle_t s_playback_mutex;

esp_err_t chime_protocol_init(void) {
    if (s_playback_mutex) {
        return ESP_OK;
    }

    s_playback_mutex = xSemaphoreCreateMutex();
    return s_playback_mutex ? ESP_OK : ESP_ERR_NO_MEM;
}

static void stop_playback_locked(void) {
    if (s_playback.handle) {
        chime_stop(s_playback.handle);
        s_playback.handle = NULL;
    }
    s_playback.active = false;
}

/* Helper: Send error response */
static void respond_error(char* response, size_t size, const char* message) {
    snprintf(response, size, "ERROR: %s\n", message);
}

/* Helper: Send OK response */
static void respond_ok(char* response, size_t size, const char* message) {
    if (message) {
        snprintf(response, size, "OK: %s\n", message);
    } else {
        snprintf(response, size, "OK\n");
    }
}

/* Command: TOOL_ID */
static void cmd_tool_id(char* response, size_t size) {
    snprintf(response, size, "OK: ESP32_SYSTEM_CHIMES_V2\n");
}

/* Command: QUERY_SLOTS */
static void cmd_query_slots(char* response, size_t size) {
    chime_slot_info_t* slots = calloc(CHIME_MAX_SLOTS, sizeof(*slots));
    if (!slots) {
        respond_error(response, size, "Out of memory");
        return;
    }

    size_t slot_count = 0;
    
    esp_err_t ret = chime_get_slots(slots, CHIME_MAX_SLOTS, &slot_count);
    if (ret != ESP_OK) {
        free(slots);
        respond_error(response, size, "Failed to query slots");
        return;
    }
    
    cJSON* root = cJSON_CreateObject();
    cJSON* slots_array = cJSON_CreateArray();
    char* json_str = NULL;
    if (!root || !slots_array) {
        goto failed;
    }
    
    for (size_t i = 0; i < slot_count; i++) {
        cJSON* slot_obj = cJSON_CreateObject();
        if (!slot_obj ||
            !cJSON_AddStringToObject(slot_obj, "slot_id", slots[i].slot_id) ||
            !cJSON_AddBoolToObject(slot_obj, "has_sound", slots[i].has_sound) ||
            !cJSON_AddNumberToObject(slot_obj, "duration_ms", slots[i].duration_ms) ||
            !cJSON_AddItemToArray(slots_array, slot_obj)) {
            cJSON_Delete(slot_obj);
            goto failed;
        }
    }
    
    if (!cJSON_AddItemToObject(root, "slots", slots_array)) {
        goto failed;
    }
    slots_array = NULL;
    if (!cJSON_AddNumberToObject(root, "count", slot_count)) {
        goto failed;
    }
    
    json_str = cJSON_PrintUnformatted(root);
    if (!json_str) {
        goto failed;
    }

    int written = snprintf(response, size, "OK: %s\n", json_str);
    if (written < 0 || (size_t)written >= size) {
        respond_error(response, size, "Response buffer too small");
    }

    free(json_str);
    cJSON_Delete(slots_array);
    cJSON_Delete(root);
    free(slots);
    return;

failed:
    free(json_str);
    cJSON_Delete(slots_array);
    cJSON_Delete(root);
    free(slots);
    respond_error(response, size, "Failed to build slot response");
}

/* Command: GET_SLOT <slot_id> */
static void cmd_get_slot(const char* slot_id, char* response, size_t size) {
    if (!slot_id || !slot_id[0]) {
        respond_error(response, size, "Missing slot_id");
        return;
    }
    
    if (!chime_slot_exists(slot_id)) {
        respond_error(response, size, "Slot not registered");
        return;
    }
    
    chime_sound_t* sound = malloc(sizeof(*sound));
    if (!sound) {
        respond_error(response, size, "Out of memory");
        return;
    }

    esp_err_t ret = chime_load_sound(slot_id, sound);
    if (ret != ESP_OK) {
        free(sound);
        respond_error(response, size, "No sound data");
        return;
    }
    
    cJSON* root = cJSON_CreateObject();
    cJSON* layers_array = cJSON_CreateArray();
    char* json_str = NULL;
    if (!root || !layers_array ||
        !cJSON_AddStringToObject(root, "slot_id", sound->slot_id) ||
        !cJSON_AddNumberToObject(root, "total_duration_ms", sound->total_duration_ms) ||
        !cJSON_AddNumberToObject(root, "layer_count", sound->layer_count)) {
        goto failed;
    }

    for (uint8_t i = 0; i < sound->layer_count; i++) {
        const chime_layer_t* layer = &sound->layers[i];
        cJSON* layer_obj = cJSON_CreateObject();
        if (!layer_obj || !cJSON_AddItemToArray(layers_array, layer_obj)) {
            cJSON_Delete(layer_obj);
            goto failed;
        }

        if (!cJSON_AddNumberToObject(layer_obj, "waveform", layer->waveform) ||
            !cJSON_AddNumberToObject(layer_obj, "volume", layer->volume) ||
            !cJSON_AddNumberToObject(layer_obj, "note_count", layer->note_count)) {
            goto failed;
        }

        cJSON* adsr = cJSON_CreateObject();
        if (!adsr ||
            !cJSON_AddItemToObject(layer_obj, "adsr", adsr)) {
            cJSON_Delete(adsr);
            goto failed;
        }
        if (!cJSON_AddNumberToObject(adsr, "attack_ms", layer->adsr.attack_ms) ||
            !cJSON_AddNumberToObject(adsr, "decay_ms", layer->adsr.decay_ms) ||
            !cJSON_AddNumberToObject(adsr, "sustain_level", layer->adsr.sustain_level) ||
            !cJSON_AddNumberToObject(adsr, "release_ms", layer->adsr.release_ms)) {
            goto failed;
        }

        cJSON* notes_array = cJSON_CreateArray();
        if (!notes_array ||
            !cJSON_AddItemToObject(layer_obj, "notes", notes_array)) {
            cJSON_Delete(notes_array);
            goto failed;
        }

        for (uint8_t n = 0; n < layer->note_count; n++) {
            const chime_note_t* note = &layer->notes[n];
            cJSON* note_obj = cJSON_CreateObject();
            if (!note_obj || !cJSON_AddItemToArray(notes_array, note_obj)) {
                cJSON_Delete(note_obj);
                goto failed;
            }
            if (!cJSON_AddNumberToObject(note_obj, "start_time_ms", note->start_time_ms) ||
                !cJSON_AddNumberToObject(note_obj, "duration_ms", note->duration_ms) ||
                !cJSON_AddNumberToObject(note_obj, "frequency_hz", note->frequency_hz)) {
                goto failed;
            }
        }
    }
    if (!cJSON_AddItemToObject(root, "layers", layers_array)) {
        goto failed;
    }
    layers_array = NULL;

    json_str = cJSON_PrintUnformatted(root);
    if (!json_str) {
        goto failed;
    }

    int written = snprintf(response, size, "OK: %s\n", json_str);
    if (written < 0 || (size_t)written >= size) {
        respond_error(response, size, "Response buffer too small");
    }
    
    free(json_str);
    cJSON_Delete(root);
    free(sound);
    return;

failed:
    free(json_str);
    cJSON_Delete(layers_array);
    cJSON_Delete(root);
    free(sound);
    respond_error(response, size, "Failed to encode sound");
}

/* Command: UPLOAD <slot_id> <json> */
static chime_sound_t* parse_sound_cjson(cJSON* root, const char* slot_id) {
    if (!root) return NULL;

    chime_sound_t* sound = calloc(1, sizeof(*sound));
    if (!sound) return NULL;

    if (slot_id) {
        strncpy(sound->slot_id, slot_id, CHIME_SLOT_ID_MAX_LEN - 1);
        sound->slot_id[CHIME_SLOT_ID_MAX_LEN - 1] = '\0';
    }

    cJSON* duration = cJSON_GetObjectItem(root, "total_duration_ms");
    cJSON* layers = cJSON_GetObjectItem(root, "layers");
    if (!cJSON_IsNumber(duration) || !isfinite(duration->valuedouble) ||
        duration->valuedouble < 1.0 || duration->valuedouble > UINT32_MAX ||
        floor(duration->valuedouble) != duration->valuedouble ||
        !cJSON_IsArray(layers)) {
        free(sound);
        return NULL;
    }

    int layer_count = cJSON_GetArraySize(layers);
    if (layer_count < 1 || layer_count > CHIME_MAX_LAYERS) {
        free(sound);
        return NULL;
    }

    sound->total_duration_ms = (uint32_t)duration->valuedouble;
    sound->layer_count = (uint8_t)layer_count;

    for (uint8_t i = 0; i < sound->layer_count; i++) {
        cJSON* layer_obj = cJSON_GetArrayItem(layers, i);
        if (!cJSON_IsObject(layer_obj)) {
            free(sound);
            return NULL;
        }

        chime_layer_t* layer = &sound->layers[i];
        cJSON* wf = cJSON_GetObjectItem(layer_obj, "waveform");
        cJSON* vol = cJSON_GetObjectItem(layer_obj, "volume");
        cJSON* adsr = cJSON_GetObjectItem(layer_obj, "adsr");
        cJSON* notes = cJSON_GetObjectItem(layer_obj, "notes");
        if (!cJSON_IsNumber(wf) || !isfinite(wf->valuedouble) ||
            floor(wf->valuedouble) != wf->valuedouble ||
            wf->valuedouble < CHIME_WAVE_SINE || wf->valuedouble >= CHIME_WAVE_MAX ||
            !cJSON_IsNumber(vol) || !isfinite(vol->valuedouble) ||
            vol->valuedouble < 0.0 || vol->valuedouble > 1.0 ||
            !cJSON_IsObject(adsr) || !cJSON_IsArray(notes)) {
            free(sound);
            return NULL;
        }

        layer->waveform = (chime_waveform_t)wf->valuedouble;
        layer->volume = (float)vol->valuedouble;
        cJSON* attack = cJSON_GetObjectItem(adsr, "attack_ms");
        cJSON* decay = cJSON_GetObjectItem(adsr, "decay_ms");
        cJSON* sustain = cJSON_GetObjectItem(adsr, "sustain_level");
        cJSON* release = cJSON_GetObjectItem(adsr, "release_ms");
        cJSON* adsr_values[] = {attack, decay, release};
        for (size_t value = 0; value < sizeof(adsr_values) / sizeof(adsr_values[0]); value++) {
            cJSON* item = adsr_values[value];
            if (!cJSON_IsNumber(item) || !isfinite(item->valuedouble) ||
                item->valuedouble < 0.0 || item->valuedouble > UINT16_MAX ||
                floor(item->valuedouble) != item->valuedouble) {
                free(sound);
                return NULL;
            }
        }

        if (!cJSON_IsNumber(sustain) || !isfinite(sustain->valuedouble) ||
            sustain->valuedouble < 0.0 || sustain->valuedouble > 1.0) {
            free(sound);
            return NULL;
        }

        layer->adsr.attack_ms = (uint16_t)attack->valuedouble;
        layer->adsr.decay_ms = (uint16_t)decay->valuedouble;
        layer->adsr.sustain_level = (float)sustain->valuedouble;
        layer->adsr.release_ms = (uint16_t)release->valuedouble;

        int note_count = cJSON_GetArraySize(notes);
        if (note_count > CHIME_MAX_NOTES) {
            free(sound);
            return NULL;
        }
        layer->note_count = (uint8_t)note_count;

        for (uint8_t n = 0; n < layer->note_count; n++) {
            cJSON* note_obj = cJSON_GetArrayItem(notes, n);
            if (!cJSON_IsObject(note_obj)) {
                free(sound);
                return NULL;
            }

            cJSON* start = cJSON_GetObjectItem(note_obj, "start_time_ms");
            cJSON* note_duration = cJSON_GetObjectItem(note_obj, "duration_ms");
            cJSON* frequency = cJSON_GetObjectItem(note_obj, "frequency_hz");
            if (!cJSON_IsNumber(start) || !isfinite(start->valuedouble) ||
                start->valuedouble < 0.0 || start->valuedouble > UINT32_MAX ||
                floor(start->valuedouble) != start->valuedouble ||
                !cJSON_IsNumber(note_duration) || !isfinite(note_duration->valuedouble) ||
                note_duration->valuedouble < 1.0 || note_duration->valuedouble > UINT32_MAX ||
                floor(note_duration->valuedouble) != note_duration->valuedouble ||
                (uint64_t)start->valuedouble + (uint64_t)note_duration->valuedouble >
                    sound->total_duration_ms ||
                !cJSON_IsNumber(frequency) || !isfinite(frequency->valuedouble) ||
                frequency->valuedouble <= 0.0 || frequency->valuedouble > 20000.0) {
                free(sound);
                return NULL;
            }

            chime_note_t* note = &layer->notes[n];
            note->start_time_ms = (uint32_t)start->valuedouble;
            note->duration_ms = (uint32_t)note_duration->valuedouble;
            note->frequency_hz = (float)frequency->valuedouble;
        }
    }

    return sound;
}

/* Command: UPLOAD <slot_id> <json> */
static void cmd_upload(const char* args, char* response, size_t size) {
    char slot_id[CHIME_SLOT_ID_MAX_LEN];
    const char* json_start = strchr(args, ' ');
    
    if (!json_start) {
        respond_error(response, size, "Invalid format: UPLOAD <slot_id> <json>");
        return;
    }
    
    size_t slot_id_len = json_start - args;
    if (slot_id_len >= CHIME_SLOT_ID_MAX_LEN) {
        respond_error(response, size, "Slot ID too long");
        return;
    }
    
    strncpy(slot_id, args, slot_id_len);
    slot_id[slot_id_len] = '\0';
    json_start++; // Skip space
    
    if (!chime_slot_exists(slot_id)) {
        respond_error(response, size, "Slot not registered");
        return;
    }
    
    cJSON* root = cJSON_Parse(json_start);
    if (!root) {
        respond_error(response, size, "Invalid JSON");
        return;
    }

    chime_sound_t* sound = parse_sound_cjson(root, slot_id);
    cJSON_Delete(root);
    if (!sound) {
        respond_error(response, size, "Invalid sound data");
        return;
    }
    
    esp_err_t ret = chime_save_sound(sound);
    free(sound);
    if (ret != ESP_OK) {
        respond_error(response, size, esp_err_to_name(ret));
        return;
    }
    
    respond_ok(response, size, "Sound uploaded");
}

/* Command: PREVIEW <json> */
static void cmd_preview(const char* json_start, char* response, size_t size) {
    if (!json_start || !json_start[0]) {
        respond_error(response, size, "Usage: PREVIEW <json>");
        return;
    }
    
    cJSON* root = cJSON_Parse(json_start);
    if (!root) {
        respond_error(response, size, "Invalid JSON");
        return;
    }

    chime_sound_t* sound = parse_sound_cjson(root, "_PREVIEW_");
    cJSON_Delete(root);
    if (!sound) {
        respond_error(response, size, "Invalid sound data");
        return;
    }

    if (!s_playback_mutex) {
        free(sound);
        respond_error(response, size, "Protocol not initialized");
        return;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    stop_playback_locked();
    esp_err_t ret = chime_play_sound(sound, &s_playback.handle);
    free(sound);
    if (ret != ESP_OK) {
        xSemaphoreGive(s_playback_mutex);
        respond_error(response, size, "Failed to play preview");
        return;
    }
    s_playback.active = true;
    xSemaphoreGive(s_playback_mutex);
    respond_ok(response, size, "Playing preview");
}

/* Command: TONE <freq_hz> <duration_ms> [waveform] */
static void cmd_tone(const char* args, char* response, size_t size) {
    if (!args || !args[0]) {
        respond_error(response, size, "Usage: TONE <freq_hz> <duration_ms> [waveform]");
        return;
    }
    float freq = 0.0f;
    unsigned long dur = 250;
    int wave = 2; // CHIME_WAVE_TRIANGLE
    int parsed = sscanf(args, "%f %lu %d", &freq, &dur, &wave);
    if (parsed < 1 || freq < 20.0f || freq > 20000.0f) {
        respond_error(response, size, "Invalid frequency");
        return;
    }
    if (dur == 0 || dur > 10000) dur = 250;
    if (wave < 0 || wave >= CHIME_WAVE_MAX) wave = 2;

    if (!s_playback_mutex) {
        respond_error(response, size, "Protocol not initialized");
        return;
    }

    chime_sound_t* sound = calloc(1, sizeof(*sound));
    if (!sound) {
        respond_error(response, size, "Out of memory");
        return;
    }

    strncpy(sound->slot_id, "_TONE_", sizeof(sound->slot_id) - 1);
    sound->total_duration_ms = (uint32_t)dur;
    sound->layer_count = 1;
    sound->layers[0].waveform = (chime_waveform_t)wave;
    sound->layers[0].volume = 0.8f;
    sound->layers[0].adsr.attack_ms = 4;
    sound->layers[0].adsr.decay_ms = 20;
    sound->layers[0].adsr.sustain_level = 0.75f;
    sound->layers[0].adsr.release_ms = 45;
    sound->layers[0].note_count = 1;
    sound->layers[0].notes[0].start_time_ms = 0;
    sound->layers[0].notes[0].duration_ms = (uint32_t)dur;
    sound->layers[0].notes[0].frequency_hz = freq;

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    stop_playback_locked();
    esp_err_t ret = chime_play_sound(sound, &s_playback.handle);
    free(sound);
    if (ret != ESP_OK) {
        xSemaphoreGive(s_playback_mutex);
        respond_error(response, size, "Failed to play tone");
        return;
    }
    s_playback.active = true;
    xSemaphoreGive(s_playback_mutex);
    respond_ok(response, size, "Playing tone");
}

/* Command: DELETE <slot_id> */
static void cmd_delete(const char* slot_id, char* response, size_t size) {
    if (!slot_id || !slot_id[0]) {
        respond_error(response, size, "Missing slot_id");
        return;
    }
    
    if (!chime_slot_exists(slot_id)) {
        respond_error(response, size, "Slot not registered");
        return;
    }

    esp_err_t ret = chime_delete_sound(slot_id);
    if (ret != ESP_OK) {
        respond_error(response, size, esp_err_to_name(ret));
        return;
    }
    
    respond_ok(response, size, "Sound deleted");
}

/* Command: ERASE_ALL */
static void cmd_erase_all(char* response, size_t size) {
    esp_err_t ret = chime_erase_all_sounds();
    if (ret != ESP_OK) {
        respond_error(response, size, "Failed to erase");
        return;
    }
    
    respond_ok(response, size, "All sounds erased");
}

/* Command: PLAY <slot_id> */
static void cmd_play(const char* slot_id, char* response, size_t size) {
    if (!slot_id || !slot_id[0]) {
        respond_error(response, size, "Missing slot_id");
        return;
    }

    if (!s_playback_mutex) {
        respond_error(response, size, "Protocol not initialized");
        return;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    stop_playback_locked();
    esp_err_t ret = chime_play(slot_id, &s_playback.handle);
    if (ret != ESP_OK) {
        xSemaphoreGive(s_playback_mutex);
        respond_error(response, size, "Failed to play");
        return;
    }
    
    s_playback.active = true;
    xSemaphoreGive(s_playback_mutex);
    respond_ok(response, size, "Playing");
}

/* Command: STOP */
static void cmd_stop(char* response, size_t size) {
    if (!s_playback_mutex) {
        respond_error(response, size, "Protocol not initialized");
        return;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    bool was_playing = s_playback.active && s_playback.handle;
    stop_playback_locked();
    xSemaphoreGive(s_playback_mutex);
    if (was_playing) {
        respond_ok(response, size, "Stopped");
    } else {
        respond_ok(response, size, "Not playing");
    }
}

/* Command: PLAY_STATUS */
static void cmd_play_status(char* response, size_t size) {
    respond_ok(
        response,
        size,
        chime_protocol_is_playing() ? "Playing" : "Not playing"
    );
}

esp_err_t chime_protocol_stop(void) {
    if (!s_playback_mutex) {
        return ESP_ERR_INVALID_STATE;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    stop_playback_locked();
    xSemaphoreGive(s_playback_mutex);
    return ESP_OK;
}

/* Command: SET_VOLUME <value> */
static void cmd_set_volume(const char* value_str, char* response, size_t size) {
    if (!value_str) {
        respond_error(response, size, "Missing volume value");
        return;
    }
    
    char* end = NULL;
    errno = 0;
    float volume = strtof(value_str, &end);
    while (end && (*end == ' ' || *end == '\t')) {
        end++;
    }
    if (end == value_str || !end || *end != '\0' || errno == ERANGE ||
        !isfinite(volume)) {
        respond_error(response, size, "Invalid volume");
        return;
    }

    esp_err_t ret = chime_set_volume(volume);
    if (ret != ESP_OK) {
        respond_error(response, size, "Invalid volume");
        return;
    }
    
    respond_ok(response, size, "Volume set");
}

/* Command: GET_VOLUME */
static void cmd_get_volume(char* response, size_t size) {
    float volume = chime_get_volume();
    snprintf(response, size, "OK: %.2f\n", volume);
}

/* Main command processor */
esp_err_t chime_protocol_process(const char* command, 
                                  char* response, 
                                  size_t response_size) {
    if (!command || !response || response_size == 0) {
        return ESP_ERR_INVALID_ARG;
    }
    
    // Trim whitespace
    while (*command == ' ' || *command == '\t' || *command == '\r' || *command == '\n') {
        command++;
    }
    
    if (*command == '\0') {
        respond_error(response, response_size, "Empty command");
        return ESP_OK;
    }
    
    size_t command_length = strlen(command);
    while (command_length > 0 &&
           (command[command_length - 1] == ' ' || command[command_length - 1] == '\t')) {
        command_length--;
    }

    // Parse command
    if (command_length == 7 && strncmp(command, "TOOL_ID", 7) == 0) {
        cmd_tool_id(response, response_size);
    }
    else if (command_length == 11 && strncmp(command, "QUERY_SLOTS", 11) == 0) {
        cmd_query_slots(response, response_size);
    }
    else if (strncmp(command, "GET_SLOT ", 9) == 0) {
        cmd_get_slot(command + 9, response, response_size);
    }
    else if (strncmp(command, "UPLOAD ", 7) == 0) {
        cmd_upload(command + 7, response, response_size);
    }
    else if (strncmp(command, "PREVIEW ", 8) == 0) {
        cmd_preview(command + 8, response, response_size);
    }
    else if (strncmp(command, "TONE ", 5) == 0) {
        cmd_tone(command + 5, response, response_size);
    }
    else if (strncmp(command, "DELETE ", 7) == 0) {
        cmd_delete(command + 7, response, response_size);
    }
    else if (command_length == 9 && strncmp(command, "ERASE_ALL", 9) == 0) {
        cmd_erase_all(response, response_size);
    }
    else if (strncmp(command, "PLAY ", 5) == 0) {
        cmd_play(command + 5, response, response_size);
    }
    else if (command_length == 4 && strncmp(command, "STOP", 4) == 0) {
        cmd_stop(response, response_size);
    }
    else if (command_length == 11 && strncmp(command, "PLAY_STATUS", 11) == 0) {
        cmd_play_status(response, response_size);
    }
    else if (strncmp(command, "SET_VOLUME ", 11) == 0) {
        cmd_set_volume(command + 11, response, response_size);
    }
    else if (command_length == 10 && strncmp(command, "GET_VOLUME", 10) == 0) {
        cmd_get_volume(response, response_size);
    }
    else {
        respond_error(response, response_size, "Unknown command");
    }
    
    return ESP_OK;
}

bool chime_protocol_is_playing(void) {
    if (!s_playback_mutex) {
        return false;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    if (s_playback.active && s_playback.handle) {
        if (chime_is_finished(s_playback.handle)) {
            stop_playback_locked();
            xSemaphoreGive(s_playback_mutex);
            return false;
        }
        xSemaphoreGive(s_playback_mutex);
        return true;
    }
    xSemaphoreGive(s_playback_mutex);
    return false;
}

esp_err_t chime_protocol_render(int16_t* buffer, 
                                 size_t buffer_size, 
                                 size_t* samples_rendered) {
    if (!buffer || !samples_rendered) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!s_playback_mutex) {
        return ESP_ERR_INVALID_STATE;
    }

    xSemaphoreTake(s_playback_mutex, portMAX_DELAY);
    if (!s_playback.active || !s_playback.handle) {
        xSemaphoreGive(s_playback_mutex);
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t ret = chime_render(s_playback.handle, buffer, buffer_size, samples_rendered);
    xSemaphoreGive(s_playback_mutex);
    return ret;
}
