/**
 * @file system_chimes.h
 * @brief User-definable system chime synthesis for ESP32
 * 
 * Flexible synthesizer with NVS-backed sound storage.
 * Users define slot IDs in firmware, design sounds in PC tool.
 * 
 * @note Breaking change: v2.0.0 removes hardcoded chimes.
 *       Sounds are now stored in NVS and user-definable.
 */

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Maximum limits */
#define CHIME_MAX_SLOTS         64      ///< Maximum number of sound slots
#define CHIME_MAX_LAYERS        8       ///< Maximum layers per sound
#define CHIME_MAX_NOTES         32      ///< Maximum notes per layer
#define CHIME_SLOT_ID_MAX_LEN   32      ///< Slot ID storage capacity
#define CHIME_SLOT_ID_MAX_CHARS 15      ///< ESP-IDF NVS key limit

/**
 * @brief Waveform types for synthesis
 */
typedef enum {
    CHIME_WAVE_SINE = 0,        ///< Pure sine wave
    CHIME_WAVE_SQUARE,          ///< Square wave
    CHIME_WAVE_TRIANGLE,        ///< Triangle wave
    CHIME_WAVE_SAWTOOTH,        ///< Sawtooth wave
    CHIME_WAVE_NOISE,           ///< White noise
    CHIME_WAVE_MAX
} chime_waveform_t;

/**
 * @brief ADSR envelope configuration
 */
typedef struct {
    uint16_t attack_ms;         ///< Attack time in milliseconds
    uint16_t decay_ms;          ///< Decay time in milliseconds
    float sustain_level;        ///< Sustain level (0.0 - 1.0)
    uint16_t release_ms;        ///< Release time in milliseconds
} chime_adsr_t;

/**
 * @brief Single note in a layer
 */
typedef struct {
    uint32_t start_time_ms;     ///< When note starts (from beginning)
    uint32_t duration_ms;       ///< How long note plays
    float frequency_hz;         ///< Note frequency in Hz
} chime_note_t;

/**
 * @brief Sound layer definition
 */
typedef struct {
    chime_waveform_t waveform;  ///< Waveform type
    chime_adsr_t adsr;          ///< Envelope settings
    float volume;               ///< Layer volume (0.0 - 1.0)
    uint8_t note_count;         ///< Number of notes in this layer
    chime_note_t notes[CHIME_MAX_NOTES]; ///< Note sequence
} chime_layer_t;

/**
 * @brief Complete sound definition
 */
typedef struct {
    char slot_id[CHIME_SLOT_ID_MAX_LEN]; ///< Slot identifier
    uint32_t total_duration_ms; ///< Total sound duration
    uint8_t layer_count;        ///< Number of layers
    chime_layer_t layers[CHIME_MAX_LAYERS]; ///< Layer data
} chime_sound_t;

/**
 * @brief System chime configuration
 */
typedef struct {
    uint32_t sample_rate;       ///< Sample rate (e.g., 16000, 44100)
    float master_volume;        ///< Master volume (0.0 - 1.0)
    bool enabled;               ///< Global enable/disable
} chime_config_t;

/**
 * @brief Chime playback handle (opaque)
 */
typedef struct chime_handle* chime_handle_t;

/**
 * @brief Slot status information
 */
typedef struct {
    char slot_id[CHIME_SLOT_ID_MAX_LEN]; ///< Slot identifier
    bool has_sound;             ///< True if sound data exists in NVS
    uint32_t duration_ms;       ///< Sound duration (0 if no sound)
} chime_slot_info_t;

/**
 * @brief Current capacity of the default NVS partition and 8-bit heap.
 *
 * NVS entry counts include all namespaces in the shared default partition,
 * not only the chime namespace.
 */
typedef struct {
    size_t nvs_used_entries;
    size_t nvs_free_entries;
    size_t nvs_available_entries;
    size_t nvs_total_entries;
    size_t nvs_namespace_count;
    size_t heap_free_bytes;
    size_t heap_largest_free_block_bytes;
} chime_storage_info_t;

/* ========================================================================
 * INITIALIZATION
 * ======================================================================== */

/**
 * @brief Get default configuration
 * 
 * @param[out] config Output configuration with defaults
 */
void chime_get_default_config(chime_config_t* config);

/**
 * @brief Initialize the chime system
 * 
 * Initializes synthesis and opens the chime namespace in the application's
 * default NVS partition. The application must initialize that partition first.
 * 
 * @param config Configuration structure
 * @return ESP_OK on success
 */
esp_err_t chime_init(const chime_config_t* config);

/**
 * @brief Query live storage and heap capacity.
 *
 * The application must initialize the default NVS partition before
 * chime_init(). This function reports shared NVS capacity and current heap
 * state without reserving or modifying either resource.
 */
esp_err_t chime_get_storage_info(chime_storage_info_t* info);

/**
 * @brief Deinitialize the chime system
 * 
 * @return ESP_OK on success
 */
esp_err_t chime_deinit(void);

/* ========================================================================
 * SLOT MANAGEMENT (Firmware-side)
 * ======================================================================== */

/**
 * @brief Register a sound slot after chime_init().
 * 
 * Call this during app_main() to define which slot IDs are available.
 * Sounds are uploaded later via PC tool.
 * 
 * Example:
 * @code
 * chime_register_slot("BOOT_SUCCESS");
 * chime_register_slot("AUTH_DENIED");
 * @endcode
 * 
 * @param slot_id Unique identifier (max 15 characters; ESP-IDF NVS key limit)
 * @return ESP_OK on success
 *         ESP_ERR_NO_MEM if slot limit reached
 *         ESP_ERR_INVALID_ARG if slot_id too long or NULL
 */
esp_err_t chime_register_slot(const char* slot_id);

/**
 * @brief Get information about all registered slots
 * 
 * @param[out] slots Array to store slot info
 * @param max_slots Size of slots array
 * @param[out] slot_count Number of slots written
 * @return ESP_OK on success
 */
esp_err_t chime_get_slots(chime_slot_info_t* slots, size_t max_slots, size_t* slot_count);

/**
 * @brief Check if a slot is registered
 * 
 * @param slot_id Slot identifier
 * @return true if registered
 */
bool chime_slot_exists(const char* slot_id);

/* ========================================================================
 * SOUND DATA MANAGEMENT (NVS Storage)
 * ======================================================================== */

/**
 * @brief Save sound to NVS
 * 
 * Usually called from serial protocol handler (PC tool upload).
 * 
 * @param sound Sound definition to save
 * @return ESP_OK on success
 *         ESP_ERR_NOT_FOUND if slot not registered
 *         ESP_ERR_NO_MEM if NVS full
 */
esp_err_t chime_save_sound(const chime_sound_t* sound);

/**
 * @brief Load sound from NVS
 * 
 * @param slot_id Slot identifier
 * @param[out] sound Output sound definition
 * @return ESP_OK on success
 *         ESP_ERR_NOT_FOUND if no sound data for this slot
 */
esp_err_t chime_load_sound(const char* slot_id, chime_sound_t* sound);

/**
 * @brief Delete sound from NVS
 * 
 * @param slot_id Slot identifier
 * @return ESP_OK on success
 */
esp_err_t chime_delete_sound(const char* slot_id);

/**
 * @brief Erase all sounds from NVS
 * 
 * @return ESP_OK on success
 */
esp_err_t chime_erase_all_sounds(void);

/**
 * @brief Check whether a registered slot has sound data in NVS.
 * 
 * @param slot_id Slot identifier
 * @param[out] has_sound True when sound data exists; false for an empty slot.
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if the slot is not registered,
 *         or an error if NVS could not be queried.
 */
esp_err_t chime_has_sound(const char* slot_id, bool* has_sound);

/* ========================================================================
 * PLAYBACK
 * ======================================================================== */

/**
 * @brief Play a sound
 * 
 * Loads sound from NVS and starts rendering.
 * 
 * Example:
 * @code
 * chime_handle_t handle;
 * chime_play("BOOT_SUCCESS", &handle);
 * 
 * // Render loop:
 * while (!chime_is_finished(handle)) {
 *     chime_render(handle, pcm_buffer, buffer_size, &rendered);
 *     // Send to audio hardware...
 * }
 * chime_stop(handle);
 * @endcode
 * 
 * @param slot_id Slot identifier
 * @param[out] handle Playback handle
 * @return ESP_OK on success
 *         ESP_ERR_NOT_FOUND if slot not registered or no sound data
 *         ESP_ERR_INVALID_STATE if system not initialized or disabled
 */
esp_err_t chime_play(const char* slot_id, chime_handle_t* handle);

/**
 * @brief Play a chime sound structure directly (without requiring NVS storage)
 * 
 * @param sound Pointer to sound definition
 * @param[out] handle Playback handle
 * @return ESP_OK on success
 */
esp_err_t chime_play_sound(const chime_sound_t* sound, chime_handle_t* handle);

/**
 * @brief Render PCM samples
 * 
 * Call this repeatedly to get audio data.
 * 
 * @param handle Playback handle
 * @param[out] buffer Output buffer for int16_t PCM samples
 * @param buffer_size Number of samples to render
 * @param[out] samples_rendered Actual samples rendered
 * @return ESP_OK on success
 *         ESP_ERR_INVALID_STATE if playback finished
 */
esp_err_t chime_render(chime_handle_t handle, int16_t* buffer, 
                       size_t buffer_size, size_t* samples_rendered);

/**
 * @brief Check if playback finished
 * 
 * @param handle Playback handle
 * @return true if finished
 */
bool chime_is_finished(chime_handle_t handle);

/**
 * @brief Stop playback and free resources
 * 
 * @param handle Playback handle
 * @return ESP_OK on success
 */
esp_err_t chime_stop(chime_handle_t handle);

/* ========================================================================
 * GLOBAL SETTINGS
 * ======================================================================== */

/**
 * @brief Set master volume
 * 
 * @param volume Volume level (0.0 - 1.0)
 * @return ESP_OK on success
 */
esp_err_t chime_set_volume(float volume);

/**
 * @brief Get current master volume
 * 
 * @return Current volume (0.0 - 1.0)
 */
float chime_get_volume(void);

/**
 * @brief Enable or disable all chimes
 * 
 * @param enabled true to enable, false to disable
 * @return ESP_OK on success
 */
esp_err_t chime_set_enabled(bool enabled);

/**
 * @brief Check if chimes are enabled
 * 
 * @return true if enabled
 */
bool chime_is_enabled(void);

#ifdef __cplusplus
}
#endif
