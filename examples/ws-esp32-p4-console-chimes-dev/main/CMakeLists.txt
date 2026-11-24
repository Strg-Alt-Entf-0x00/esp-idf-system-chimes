idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES
        esp-idf-system-chimes
        esp_driver_i2c
        esp_driver_i2s
        esp_codec_dev
        console
        nvs_flash
)
