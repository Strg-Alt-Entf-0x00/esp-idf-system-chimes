/**
 * @file chime_nvs.h
 * @brief NVS storage for chime sound data
 */

#pragma once

#include "system_chimes.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize NVS storage for chimes
 * 
 * @return ESP_OK on success
 */
esp_err_t chime_nvs_init(void);

/**
 * @brief Deinitialize NVS storage
 * 
 * @return ESP_OK on success
 */
esp_err_t chime_nvs_deinit(void);

/**
 * @brief Save sound to NVS
 * 
 * @param sound Sound definition
 * @return ESP_OK on success
 */
esp_err_t chime_nvs_save(const chime_sound_t* sound);

/**
 * @brief Load sound from NVS
 * 
 * @param slot_id Slot identifier
 * @param sound Output buffer
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if not exists
 */
esp_err_t chime_nvs_load(const char* slot_id, chime_sound_t* sound);

/**
 * @brief Check if sound exists in NVS
 * 
 * @param slot_id Slot identifier
 * @return true if exists
 */
esp_err_t chime_nvs_exists(const char* slot_id, bool* exists);

/**
 * @brief Delete sound from NVS
 * 
 * @param slot_id Slot identifier
 * @return ESP_OK on success
 */
esp_err_t chime_nvs_delete(const char* slot_id);

/**
 * @brief Erase all sounds from NVS
 * 
 * @return ESP_OK on success
 */
esp_err_t chime_nvs_erase_all(void);

#ifdef __cplusplus
}
#endif
