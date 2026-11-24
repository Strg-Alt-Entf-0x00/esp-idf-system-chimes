/**
 * @file chime_synth.h
 * @brief Internal synthesizer engine for multi-layer chime rendering
 */

#pragma once

#include "system_chimes.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Create a new chime synthesizer instance
 * 
 * @param sound Sound definition with layers
 * @param sample_rate Sample rate (Hz)
 * @param master_volume Master volume (0.0-1.0)
 * @param handle Output handle
 * @return ESP_OK on success
 */
esp_err_t chime_synth_create(const chime_sound_t* sound,
                              uint32_t sample_rate,
                              float master_volume,
                              chime_handle_t* handle);

/**
 * @brief Render PCM samples from synthesizer
 * 
 * @param handle Synthesizer handle
 * @param buffer Output PCM buffer (int16_t samples)
 * @param buffer_size Number of samples to render
 * @param samples_rendered Actual samples rendered
 * @return ESP_OK on success, ESP_ERR_INVALID_STATE if finished
 */
esp_err_t chime_synth_render(chime_handle_t handle,
                              int16_t* buffer,
                              size_t buffer_size,
                              size_t* samples_rendered);

/**
 * @brief Check if synthesis is complete
 * 
 * @param handle Synthesizer handle
 * @return true if finished
 */
bool chime_synth_is_finished(chime_handle_t handle);

/**
 * @brief Destroy synthesizer instance
 * 
 * @param handle Synthesizer handle
 * @return ESP_OK on success
 */
esp_err_t chime_synth_destroy(chime_handle_t handle);

#ifdef __cplusplus
}
#endif
