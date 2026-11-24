/**
 * @file main.c
 * @brief Waveshare ESP32-P4 System Chimes Designer Console
 * 
 * Serial console for chime sound design with PC tool integration.
 * Supports user-defined sound slots with NVS storage.
 * 
 * @note v2.0.0 - Complete architecture redesign
 *       Sounds are now user-definable via PC tool, not hardcoded.
 */

#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "es8311_codec.h"
#include "esp_codec_dev.h"
#include "esp_codec_dev_defaults.h"
#include "esp_log.h"
#include "esp_check.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "sdkconfig.h"
#include "system_chimes.h"
#include "chime_protocol.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "chimes_console";

// Waveshare ESP32-P4-WIFI6 board pinout
enum {
    BOARD_I2C_SDA_GPIO = 7,
    BOARD_I2C_SCL_GPIO = 8,
    BOARD_I2S_DOUT_GPIO = 9,
    BOARD_I2S_WS_GPIO = 10,
    BOARD_I2S_BCLK_GPIO = 12,
    BOARD_I2S_MCLK_GPIO = 13,
    BOARD_PA_ENABLE_GPIO = 53,
    AUDIO_SAMPLE_RATE = CONFIG_CHIMES_DEFAULT_SAMPLE_RATE,
    AUDIO_CHUNK_SAMPLES = 256,
    COMMAND_BUFFER_SIZE = 32768,
    RESPONSE_BUFFER_SIZE = 32768,
};

typedef enum {
    AUDIO_STATE_INITIALIZING,
    AUDIO_STATE_READY,
    AUDIO_STATE_FAILED,
} audio_state_t;

static i2c_master_bus_handle_t s_i2c_bus;
static i2s_chan_handle_t s_i2s_tx;
static esp_codec_dev_handle_t s_codec;
static audio_state_t s_audio_state = AUDIO_STATE_INITIALIZING;
static int s_codec_volume = CONFIG_CHIMES_DEFAULT_VOLUME;
static TaskHandle_t s_audio_task;
static volatile bool s_running = true;

// ============================================================================
// Audio Hardware Setup (ES8311)
// ============================================================================

static esp_err_t init_audio_hardware(void) {
    ESP_LOGI(TAG, "Initializing I2C bus (SDA=%d, SCL=%d)", BOARD_I2C_SDA_GPIO, BOARD_I2C_SCL_GPIO);
    
    const i2c_master_bus_config_t i2c_cfg = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = BOARD_I2C_SDA_GPIO,
        .scl_io_num = BOARD_I2C_SCL_GPIO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    ESP_RETURN_ON_ERROR(i2c_new_master_bus(&i2c_cfg, &s_i2c_bus), TAG, "I2C bus init failed");
    
    ESP_LOGI(TAG, "Initializing I2S TX (DOUT=%d, WS=%d, BCLK=%d, MCLK=%d)",
             BOARD_I2S_DOUT_GPIO, BOARD_I2S_WS_GPIO, BOARD_I2S_BCLK_GPIO, BOARD_I2S_MCLK_GPIO);
    
    const i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    ESP_RETURN_ON_ERROR(i2s_new_channel(&chan_cfg, &s_i2s_tx, NULL), TAG, "I2S channel init failed");
    
    const i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = BOARD_I2S_MCLK_GPIO,
            .bclk = BOARD_I2S_BCLK_GPIO,
            .ws = BOARD_I2S_WS_GPIO,
            .dout = BOARD_I2S_DOUT_GPIO,
            .din = GPIO_NUM_NC,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };
    ESP_RETURN_ON_ERROR(i2s_channel_init_std_mode(s_i2s_tx, &std_cfg), TAG, "I2S STD mode init failed");
    ESP_RETURN_ON_ERROR(i2s_channel_enable(s_i2s_tx), TAG, "I2S enable failed");
    
    ESP_LOGI(TAG, "Initializing ES8311 codec");
    
    audio_codec_i2s_cfg_t i2s_codec_cfg = {
        .port = I2S_NUM_0,
        .tx_handle = s_i2s_tx,
        .rx_handle = NULL,
    };
    const audio_codec_data_if_t *data_if = audio_codec_new_i2s_data(&i2s_codec_cfg);
    ESP_RETURN_ON_FALSE(data_if, ESP_FAIL, TAG, "I2S codec interface creation failed");

    audio_codec_i2c_cfg_t i2c_codec_cfg = {
        .port = I2C_NUM_0,
        .addr = ES8311_CODEC_DEFAULT_ADDR,
        .bus_handle = s_i2c_bus,
    };
    const audio_codec_ctrl_if_t *ctrl_if = audio_codec_new_i2c_ctrl(&i2c_codec_cfg);
    ESP_RETURN_ON_FALSE(ctrl_if, ESP_FAIL, TAG, "I2C codec interface creation failed");

    const audio_codec_gpio_if_t *gpio_if = audio_codec_new_gpio();
    ESP_RETURN_ON_FALSE(gpio_if, ESP_FAIL, TAG, "Codec GPIO interface creation failed");

    es8311_codec_cfg_t es8311_cfg = {
        .ctrl_if = ctrl_if,
        .gpio_if = gpio_if,
        .codec_mode = ESP_CODEC_DEV_WORK_MODE_DAC,
        .pa_pin = BOARD_PA_ENABLE_GPIO,
        .use_mclk = true,
    };
    const audio_codec_if_t *codec_if = es8311_codec_new(&es8311_cfg);
    ESP_RETURN_ON_FALSE(codec_if, ESP_FAIL, TAG, "ES8311 codec interface creation failed");

    esp_codec_dev_cfg_t codec_dev_cfg = {
        .dev_type = ESP_CODEC_DEV_TYPE_OUT,
        .codec_if = codec_if,
        .data_if = data_if,
    };
    s_codec = esp_codec_dev_new(&codec_dev_cfg);
    ESP_RETURN_ON_FALSE(s_codec, ESP_FAIL, TAG, "Codec device creation failed");

    esp_codec_dev_sample_info_t sample_info = {
        .bits_per_sample = 16,
        .sample_rate = AUDIO_SAMPLE_RATE,
        .channel = 2,
    };
    ESP_RETURN_ON_ERROR(esp_codec_dev_open(s_codec, &sample_info), TAG, "Codec open failed");
    ESP_RETURN_ON_ERROR(
        esp_codec_dev_set_out_vol(s_codec, s_codec_volume),
        TAG, "Volume set failed"
    );
    
    ESP_LOGI(TAG, "Audio hardware initialized at %d Hz", AUDIO_SAMPLE_RATE);
    return ESP_OK;
}

// ============================================================================
// Audio Playback Task
// ============================================================================

static void audio_task(void *arg) {
    int16_t mono_buffer[AUDIO_CHUNK_SAMPLES];
    int16_t stereo_buffer[AUDIO_CHUNK_SAMPLES * 2];
    size_t samples_rendered;
    size_t bytes_written;
    
    ESP_LOGI(TAG, "Audio task started");
    
    while (s_running) {
        bool playback_active = chime_protocol_is_playing();
        bool wrote_audio = false;
        if (playback_active) {
            // Render chime audio
            esp_err_t ret = chime_protocol_render(mono_buffer, AUDIO_CHUNK_SAMPLES, &samples_rendered);
            if (ret == ESP_OK && samples_rendered > 0) {
                // Convert mono to stereo
                for (size_t i = 0; i < samples_rendered; i++) {
                    stereo_buffer[i * 2] = mono_buffer[i];
                    stereo_buffer[i * 2 + 1] = mono_buffer[i];
                }
                
                // Write to I2S
                size_t bytes_to_write = samples_rendered * 4;
                ret = i2s_channel_write(
                    s_i2s_tx,
                    stereo_buffer,
                    bytes_to_write,
                    &bytes_written,
                    portMAX_DELAY
                );
                if (ret != ESP_OK || bytes_written != bytes_to_write) {
                    ESP_LOGE(
                        TAG,
                        "I2S playback write failed: %s (%u/%u bytes)",
                        esp_err_to_name(ret),
                        (unsigned)bytes_written,
                        (unsigned)bytes_to_write
                    );
                    chime_protocol_stop();
                } else {
                    wrote_audio = true;
                }
            } else if (ret != ESP_OK) {
                ESP_LOGE(TAG, "Chime render failed: %s", esp_err_to_name(ret));
                chime_protocol_stop();
            }
        } else {
            // No playback - send silence
            memset(stereo_buffer, 0, sizeof(stereo_buffer));
            esp_err_t ret = i2s_channel_write(
                s_i2s_tx,
                stereo_buffer,
                sizeof(stereo_buffer),
                &bytes_written,
                portMAX_DELAY
            );
            if (ret != ESP_OK || bytes_written != sizeof(stereo_buffer)) {
                ESP_LOGE(
                    TAG,
                    "I2S silence write failed: %s (%u/%u bytes)",
                    esp_err_to_name(ret),
                    (unsigned)bytes_written,
                    (unsigned)sizeof(stereo_buffer)
                );
            }
        }
        
        if (!playback_active || !wrote_audio) {
            vTaskDelay(pdMS_TO_TICKS(20));
        }
    }
    
    ESP_LOGI(TAG, "Audio task stopped");
    vTaskDelete(NULL);
}

// ============================================================================
// Serial Command Handler
// ============================================================================

static void handle_command(const char* command) {
    static char response[RESPONSE_BUFFER_SIZE];
    
    esp_err_t ret = chime_protocol_process(command, response, sizeof(response));
    if (ret != ESP_OK) {
        printf("ERROR: Protocol processing failed\n");
        return;
    }
    
    // Send response (already formatted by protocol handler)
    printf("%s", response);
}

// ============================================================================
// Main
// ============================================================================

void app_main(void) {
    ESP_LOGI(TAG, "ESP32-P4 System Chimes Designer Console v2.0");
    ESP_LOGI(TAG, "==============================================");
    
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "NVS initialization failed: %s", esp_err_to_name(ret));
        return;
    }
    
    // Initialize audio hardware
    ret = init_audio_hardware();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Audio hardware init failed: %s", esp_err_to_name(ret));
        s_audio_state = AUDIO_STATE_FAILED;
        return;
    }
    s_audio_state = AUDIO_STATE_READY;
    
    // Initialize chime system
    chime_config_t chime_cfg;
    chime_get_default_config(&chime_cfg);
    chime_cfg.sample_rate = AUDIO_SAMPLE_RATE;

    ret = chime_init(&chime_cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Chime system init failed: %s", esp_err_to_name(ret));
        return;
    }
    
    ESP_LOGI(TAG, "Chime system initialized");
    
    // Register example sound slots
    // User firmware defines what slots are available
    chime_register_slot("BOOT_SUCCESS");
    chime_register_slot("BOOT_ERROR");
    chime_register_slot("AUTH_ACCEPTED");
    chime_register_slot("AUTH_DENIED");
    chime_register_slot("ERROR_CRITICAL");
    chime_register_slot("ERROR_WARNING");
    chime_register_slot("SYSTEM_READY");
    chime_register_slot("NOTIFICATION");
    chime_register_slot("CONFIRM");
    chime_register_slot("CANCEL");
    
    ESP_LOGI(TAG, "Registered 10 sound slots");

    ret = chime_protocol_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Protocol initialization failed: %s", esp_err_to_name(ret));
        return;
    }
    
    // Start audio playback task
    BaseType_t task_ret = xTaskCreate(audio_task, "audio", 4096, NULL, 5, &s_audio_task);
    if (task_ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create audio task");
        return;
    }
    
    // Announce readiness to PC tool
    printf("READY\n");
    ESP_LOGI(TAG, "Console ready. Waiting for PC tool commands...");
    
    // Main command loop
    static char command_buffer[COMMAND_BUFFER_SIZE];
    size_t cmd_pos = 0;
    bool command_overflow = false;
    
    while (1) {
        int c = getchar();
        if (c == EOF) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
        
        if (c == '\n' || c == '\r') {
            if (command_overflow) {
                printf("ERROR: Command too long\n");
            } else if (cmd_pos > 0) {
                command_buffer[cmd_pos] = '\0';
                handle_command(command_buffer);
            }
            cmd_pos = 0;
            command_overflow = false;
        } else if (!command_overflow) {
            if (cmd_pos < COMMAND_BUFFER_SIZE - 1) {
                command_buffer[cmd_pos++] = (char)c;
            } else {
                command_overflow = true;
            }
        }
    }
}
