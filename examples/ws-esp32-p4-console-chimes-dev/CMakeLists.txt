# Waveshare ESP32-P4 System Chimes Console
cmake_minimum_required(VERSION 3.16)

# Add system-chimes component directory (point to component root only)
set(EXTRA_COMPONENT_DIRS "${CMAKE_CURRENT_LIST_DIR}/../../")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(ws_esp32_p4_chimes_console)
