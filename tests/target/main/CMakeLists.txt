idf_component_register(
    SRCS "../test_chime_api.c"
    INCLUDE_DIRS "../../../include"
    REQUIRES
        esp-idf-system-chimes
        nvs_flash
        unity
)
