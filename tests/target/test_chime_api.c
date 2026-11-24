/**
 * @file test_chime_api.c
 * @brief Unit tests for system chimes API
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "unity.h"
#include "system_chimes.h"
#include "esp_system.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static bool s_nvs_initialized = false;

TEST_CASE("default configuration matches Kconfig", "[chimes][config]") {
    chime_config_t config;
    chime_get_default_config(&config);

    TEST_ASSERT_EQUAL(CONFIG_CHIMES_DEFAULT_SAMPLE_RATE, config.sample_rate);
    TEST_ASSERT_EQUAL_FLOAT(
        CONFIG_CHIMES_DEFAULT_VOLUME / 100.0f,
        config.master_volume
    );
#ifdef CONFIG_CHIMES_ENABLED_BY_DEFAULT
    TEST_ASSERT_TRUE(config.enabled);
#else
    TEST_ASSERT_FALSE(config.enabled);
#endif
}

void setUp(void) {
    if (!s_nvs_initialized) {
        esp_err_t ret = nvs_flash_init();
        if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
            ESP_ERROR_CHECK(nvs_flash_erase());
            ret = nvs_flash_init();
        }
        ESP_ERROR_CHECK(ret);
        s_nvs_initialized = true;
    }
}

void tearDown(void) {
    // Cleanup after each test
}

/* Test: Initialize and deinitialize */
TEST_CASE("chime_init and chime_deinit", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, chime_register_slot("BEFORE_INIT"));
    TEST_ASSERT_EQUAL(ESP_OK, chime_init(&config));
    TEST_ASSERT_EQUAL(ESP_OK, chime_deinit());
}

/* Test: Register slots */
TEST_CASE("chime_register_slot", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    // Valid registration
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("TEST_SLOT_1"));
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("TEST_SLOT_2"));
    
    // Duplicate registration (should succeed silently)
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("TEST_SLOT_1"));
    
    // NULL slot_id
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_register_slot(NULL));
    
    // Empty slot_id
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_register_slot(""));
    
    // Too long slot_id
    char long_id[CHIME_SLOT_ID_MAX_LEN + 10];
    memset(long_id, 'A', sizeof(long_id) - 1);
    long_id[sizeof(long_id) - 1] = '\0';
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_register_slot(long_id));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_register_slot("INVALID-SLOT"));
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("123456789012345"));
    
    chime_deinit();
}

/* Test: Slot existence check */
TEST_CASE("chime_slot_exists", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("EXISTING_SLOT");
    
    TEST_ASSERT_TRUE(chime_slot_exists("EXISTING_SLOT"));
    TEST_ASSERT_FALSE(chime_slot_exists("NONEXISTENT_SLOT"));
    TEST_ASSERT_FALSE(chime_slot_exists(NULL));
    
    chime_deinit();
}

/* Test: Get slots */
TEST_CASE("chime_get_slots", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("SLOT_A");
    chime_register_slot("SLOT_B");
    chime_register_slot("SLOT_C");
    
    chime_slot_info_t slots[10];
    size_t count = 0;
    
    TEST_ASSERT_EQUAL(ESP_OK, chime_get_slots(slots, 10, &count));
    TEST_ASSERT_EQUAL(3, count);
    
    // Verify slot IDs
    bool found_a = false, found_b = false, found_c = false;
    for (size_t i = 0; i < count; i++) {
        if (strcmp(slots[i].slot_id, "SLOT_A") == 0) found_a = true;
        if (strcmp(slots[i].slot_id, "SLOT_B") == 0) found_b = true;
        if (strcmp(slots[i].slot_id, "SLOT_C") == 0) found_c = true;
    }
    TEST_ASSERT_TRUE(found_a && found_b && found_c);
    
    chime_deinit();
}

/* Test: Save and load sound */
TEST_CASE("chime_save_sound and chime_load_sound", "[chimes][nvs]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("TEST_SOUND");
    
    // Create test sound
    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "TEST_SOUND", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 500;
    sound.layer_count = 2;
    
    // Layer 1
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 0.8f;
    sound.layers[0].adsr.attack_ms = 10;
    sound.layers[0].adsr.decay_ms = 50;
    sound.layers[0].adsr.sustain_level = 0.7f;
    sound.layers[0].adsr.release_ms = 100;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].start_time_ms = 0;
    sound.layers[0].notes[0].duration_ms = 200;
    sound.layers[0].notes[0].frequency_hz = 440.0f;
    
    // Layer 2
    sound.layers[1].waveform = CHIME_WAVE_SQUARE;
    sound.layers[1].volume = 0.6f;
    sound.layers[1].adsr.attack_ms = 5;
    sound.layers[1].adsr.decay_ms = 30;
    sound.layers[1].adsr.sustain_level = 0.5f;
    sound.layers[1].adsr.release_ms = 80;
    sound.layers[1].note_count = 1;
    sound.layers[1].notes[0].start_time_ms = 100;
    sound.layers[1].notes[0].duration_ms = 150;
    sound.layers[1].notes[0].frequency_hz = 880.0f;
    
    // Save
    TEST_ASSERT_EQUAL(ESP_OK, chime_save_sound(&sound));
    bool has_sound = false;
    TEST_ASSERT_EQUAL(ESP_OK, chime_has_sound("TEST_SOUND", &has_sound));
    TEST_ASSERT_TRUE(has_sound);

    nvs_handle_t chime_namespace;
    TEST_ASSERT_EQUAL(ESP_OK,
                      nvs_open("chimes_v1", NVS_READONLY, &chime_namespace));
    size_t encoded_size = 0;
    TEST_ASSERT_EQUAL(ESP_OK,
                      nvs_get_blob(chime_namespace, "TEST_SOUND", NULL,
                                   &encoded_size));
    TEST_ASSERT_TRUE(encoded_size < sizeof(sound) / 2);
    nvs_close(chime_namespace);
    
    // Load
    chime_sound_t loaded = {0};
    TEST_ASSERT_EQUAL(ESP_OK, chime_load_sound("TEST_SOUND", &loaded));
    
    // Verify
    TEST_ASSERT_EQUAL_STRING("TEST_SOUND", loaded.slot_id);
    TEST_ASSERT_EQUAL(500, loaded.total_duration_ms);
    TEST_ASSERT_EQUAL(2, loaded.layer_count);
    TEST_ASSERT_EQUAL(CHIME_WAVE_SINE, loaded.layers[0].waveform);
    TEST_ASSERT_EQUAL_FLOAT(0.8f, loaded.layers[0].volume);
    TEST_ASSERT_EQUAL(440.0f, loaded.layers[0].notes[0].frequency_hz);
    
    chime_deinit();
}

/* Test: Delete sound */
TEST_CASE("chime_delete_sound", "[chimes][nvs]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("DELETE_TEST");
    
    // Create and save sound
    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "DELETE_TEST", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 100;
    sound.layer_count = 1;
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 1.0f;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].start_time_ms = 0;
    sound.layers[0].notes[0].duration_ms = 100;
    sound.layers[0].notes[0].frequency_hz = 523.0f;
    
    chime_save_sound(&sound);
    bool has_sound = false;
    TEST_ASSERT_EQUAL(ESP_OK, chime_has_sound("DELETE_TEST", &has_sound));
    TEST_ASSERT_TRUE(has_sound);
    
    // Delete
    TEST_ASSERT_EQUAL(ESP_OK, chime_delete_sound("DELETE_TEST"));
    TEST_ASSERT_EQUAL(ESP_OK, chime_has_sound("DELETE_TEST", &has_sound));
    TEST_ASSERT_FALSE(has_sound);
    
    chime_deinit();
}

TEST_CASE("chime_erase_all_sounds preserves other NVS namespaces", "[chimes][nvs]") {
    chime_config_t config;
    chime_get_default_config(&config);
    TEST_ASSERT_EQUAL(ESP_OK, chime_init(&config));
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("ERASE_TEST"));

    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "ERASE_TEST", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 100;
    sound.layer_count = 1;
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 1.0f;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].duration_ms = 100;
    sound.layers[0].notes[0].frequency_hz = 440.0f;
    TEST_ASSERT_EQUAL(ESP_OK, chime_save_sound(&sound));

    nvs_handle_t other_namespace;
    TEST_ASSERT_EQUAL(ESP_OK, nvs_open("other", NVS_READWRITE, &other_namespace));
    TEST_ASSERT_EQUAL(ESP_OK, nvs_set_u32(other_namespace, "marker", 0x1234ABCD));
    TEST_ASSERT_EQUAL(ESP_OK, nvs_commit(other_namespace));

    TEST_ASSERT_EQUAL(ESP_OK, chime_erase_all_sounds());
    bool has_sound = true;
    TEST_ASSERT_EQUAL(ESP_OK, chime_has_sound("ERASE_TEST", &has_sound));
    TEST_ASSERT_FALSE(has_sound);

    uint32_t marker = 0;
    TEST_ASSERT_EQUAL(ESP_OK, nvs_get_u32(other_namespace, "marker", &marker));
    TEST_ASSERT_EQUAL_HEX32(0x1234ABCD, marker);

    nvs_close(other_namespace);
    TEST_ASSERT_EQUAL(ESP_OK, chime_deinit());
}

/* Test: Volume control */
TEST_CASE("chime_set_volume and chime_get_volume", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    // Set valid volume
    TEST_ASSERT_EQUAL(ESP_OK, chime_set_volume(0.5f));
    TEST_ASSERT_EQUAL_FLOAT(0.5f, chime_get_volume());
    
    TEST_ASSERT_EQUAL(ESP_OK, chime_set_volume(1.0f));
    TEST_ASSERT_EQUAL_FLOAT(1.0f, chime_get_volume());
    
    TEST_ASSERT_EQUAL(ESP_OK, chime_set_volume(0.0f));
    TEST_ASSERT_EQUAL_FLOAT(0.0f, chime_get_volume());
    
    // Invalid volumes
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_set_volume(-0.1f));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_set_volume(1.1f));
    
    chime_deinit();
}

TEST_CASE("storage info reports live NVS and heap capacity", "[chimes][storage]") {
    chime_config_t config;
    chime_get_default_config(&config);
    TEST_ASSERT_EQUAL(ESP_OK, chime_init(&config));

    chime_storage_info_t info = {0};
    TEST_ASSERT_EQUAL(ESP_OK, chime_get_storage_info(&info));
    TEST_ASSERT_TRUE(info.nvs_total_entries > 0);
    TEST_ASSERT_TRUE(info.nvs_free_entries <= info.nvs_total_entries);
    TEST_ASSERT_TRUE(info.nvs_available_entries <= info.nvs_free_entries);
    TEST_ASSERT_TRUE(info.heap_free_bytes > 0);
    TEST_ASSERT_TRUE(info.heap_largest_free_block_bytes <= info.heap_free_bytes);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, chime_get_storage_info(NULL));

    TEST_ASSERT_EQUAL(ESP_OK, chime_deinit());
}

/* Test: Enable/disable */
TEST_CASE("chime_set_enabled and chime_is_enabled", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    config.enabled = true;
    chime_init(&config);
    
    TEST_ASSERT_TRUE(chime_is_enabled());
    
    TEST_ASSERT_EQUAL(ESP_OK, chime_set_enabled(false));
    TEST_ASSERT_FALSE(chime_is_enabled());
    
    TEST_ASSERT_EQUAL(ESP_OK, chime_set_enabled(true));
    TEST_ASSERT_TRUE(chime_is_enabled());
    
    chime_deinit();
}

TEST_CASE("short notes with long release begin at full level", "[chimes][synth]") {
    chime_config_t config;
    chime_get_default_config(&config);
    config.master_volume = 1.0f;
    TEST_ASSERT_EQUAL(ESP_OK, chime_init(&config));
    TEST_ASSERT_EQUAL(ESP_OK, chime_register_slot("RELEASE_TEST"));

    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "RELEASE_TEST", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 10;
    sound.layer_count = 1;
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 1.0f;
    sound.layers[0].adsr.sustain_level = 1.0f;
    sound.layers[0].adsr.release_ms = 100;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].duration_ms = 10;
    sound.layers[0].notes[0].frequency_hz = 440.0f;
    TEST_ASSERT_EQUAL(ESP_OK, chime_save_sound(&sound));

    chime_handle_t handle;
    TEST_ASSERT_EQUAL(ESP_OK, chime_play("RELEASE_TEST", &handle));

    int16_t buffer[160];
    size_t rendered = 0;
    TEST_ASSERT_EQUAL(ESP_OK, chime_render(handle, buffer, 160, &rendered));
    TEST_ASSERT_EQUAL(160, rendered);
    TEST_ASSERT_TRUE(abs(buffer[5]) > 20000);
    TEST_ASSERT_TRUE(abs(buffer[130]) < abs(buffer[5]));

    TEST_ASSERT_EQUAL(ESP_OK, chime_stop(handle));
    TEST_ASSERT_EQUAL(ESP_OK, chime_delete_sound("RELEASE_TEST"));
    TEST_ASSERT_EQUAL(ESP_OK, chime_deinit());
}

/* Test: Play sound (without audio hardware) */
TEST_CASE("chime_play basic functionality", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("PLAY_TEST");
    
    // Create simple sound
    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "PLAY_TEST", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 100;
    sound.layer_count = 1;
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 0.8f;
    sound.layers[0].adsr.attack_ms = 5;
    sound.layers[0].adsr.decay_ms = 10;
    sound.layers[0].adsr.sustain_level = 0.7f;
    sound.layers[0].adsr.release_ms = 20;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].start_time_ms = 0;
    sound.layers[0].notes[0].duration_ms = 100;
    sound.layers[0].notes[0].frequency_hz = 440.0f;
    
    chime_save_sound(&sound);
    
    // Play sound
    chime_handle_t handle;
    TEST_ASSERT_EQUAL(ESP_OK, chime_play("PLAY_TEST", &handle));
    TEST_ASSERT_NOT_NULL(handle);
    TEST_ASSERT_FALSE(chime_is_finished(handle));
    
    // Render some samples
    int16_t buffer[256];
    size_t rendered;
    TEST_ASSERT_EQUAL(ESP_OK, chime_render(handle, buffer, 256, &rendered));
    TEST_ASSERT_EQUAL(256, rendered);
    
    // Stop
    TEST_ASSERT_EQUAL(ESP_OK, chime_stop(handle));
    
    chime_deinit();
}

/* Test: Try to play non-existent sound */
TEST_CASE("chime_play with non-existent sound", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    chime_init(&config);
    
    chime_register_slot("EMPTY_SLOT");
    
    chime_handle_t handle;
    TEST_ASSERT_EQUAL(ESP_ERR_NOT_FOUND, chime_play("EMPTY_SLOT", &handle));
    
    chime_deinit();
}

/* Test: Play disabled */
TEST_CASE("chime_play when disabled", "[chimes]") {
    chime_config_t config;
    chime_get_default_config(&config);
    config.enabled = false;
    chime_init(&config);
    
    chime_register_slot("TEST");
    
    chime_sound_t sound = {0};
    strncpy(sound.slot_id, "TEST", CHIME_SLOT_ID_MAX_LEN - 1);
    sound.total_duration_ms = 100;
    sound.layer_count = 1;
    sound.layers[0].waveform = CHIME_WAVE_SINE;
    sound.layers[0].volume = 1.0f;
    sound.layers[0].note_count = 1;
    sound.layers[0].notes[0].frequency_hz = 440.0f;
    chime_save_sound(&sound);
    
    chime_handle_t handle;
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, chime_play("TEST", &handle));
    
    chime_deinit();
}

void app_main(void) {
    printf("\n\n");
    printf("========================================\n");
    printf("  ESP32 System Chimes Unit Tests\n");
    printf("========================================\n\n");
    
    UNITY_BEGIN();
    
    unity_run_test_by_name("chime_init and chime_deinit");
    unity_run_test_by_name("chime_register_slot");
    unity_run_test_by_name("chime_slot_exists");
    unity_run_test_by_name("chime_get_slots");
    unity_run_test_by_name("chime_save_sound and chime_load_sound");
    unity_run_test_by_name("chime_delete_sound");
    unity_run_test_by_name("chime_erase_all_sounds preserves other NVS namespaces");
    unity_run_test_by_name("storage info reports live NVS and heap capacity");
    unity_run_test_by_name("chime_set_volume and chime_get_volume");
    unity_run_test_by_name("chime_set_enabled and chime_is_enabled");
    unity_run_test_by_name("short notes with long release begin at full level");
    unity_run_test_by_name("chime_play basic functionality");
    unity_run_test_by_name("chime_play with non-existent sound");
    unity_run_test_by_name("chime_play when disabled");
    
    UNITY_END();
    
    printf("\n========================================\n");
    printf("  All tests completed!\n");
    printf("========================================\n\n");
}
