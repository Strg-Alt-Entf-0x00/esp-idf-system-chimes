/**
 * @file chime_protocol.h
 * @brief Serial protocol for PC tool communication
 * 
 * Commands:
 *   TOOL_ID                    -> Returns firmware identifier
 *   QUERY_SLOTS                -> Returns list of registered slots (JSON)
 *   GET_SLOT <slot_id>         -> Returns sound data for slot (JSON)
 *   UPLOAD <slot_id> <json>    -> Saves sound to NVS
 *   DELETE <slot_id>           -> Erases slot from NVS
 *   ERASE_ALL                  -> Wipes all sounds
 *   PLAY <slot_id>             -> Plays sound for testing
 *   PLAY_STATUS                -> Returns current protocol playback state
 *   STOP                       -> Stops current playback
 *   SET_VOLUME <0.0-1.0>       -> Sets master volume
 *   GET_VOLUME                 -> Returns current volume
 */

#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize protocol playback synchronization
 *
 * Call once before starting the audio task.
 */
esp_err_t chime_protocol_init(void);

/**
 * @brief Process a command line and generate response
 * 
 * @param command Input command string (null-terminated)
 * @param response Output buffer for response
 * @param response_size Size of response buffer
 * @return ESP_OK on success
 */
esp_err_t chime_protocol_process(const char* command, 
                                  char* response, 
                                  size_t response_size);

/**
 * @brief Check if playback is active (for PLAY command)
 * 
 * @return true if sound is playing
 */
bool chime_protocol_is_playing(void);

/**
 * @brief Stop protocol-managed playback without emitting a serial response.
 */
esp_err_t chime_protocol_stop(void);

/**
 * @brief Render audio samples for PLAY command
 * 
 * Call this from audio callback when chime_protocol_is_playing() returns true.
 * 
 * @param buffer Output PCM buffer
 * @param buffer_size Number of samples
 * @param samples_rendered Actual samples rendered
 * @return ESP_OK on success
 */
esp_err_t chime_protocol_render(int16_t* buffer, 
                                 size_t buffer_size, 
                                 size_t* samples_rendered);

#ifdef __cplusplus
}
#endif
