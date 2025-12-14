cmake_minimum_required(VERSION 3.20)
project(ascii_dungeon VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Use FetchContent for dependencies (no vcpkg needed)
include(FetchContent)

# GLFW
FetchContent_Declare(
    glfw
    GIT_REPOSITORY https://github.com/glfw/glfw.git
    GIT_TAG 3.3.9
)
set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)

# GLM
FetchContent_Declare(
    glm
    GIT_REPOSITORY https://github.com/g-truc/glm.git
    GIT_TAG 1.0.1
)

# spdlog
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)

# VMA (Vulkan Memory Allocator) - header only
FetchContent_Declare(
    vma
    GIT_REPOSITORY https://github.com/GPUOpen-LibrariesAndSDKs/VulkanMemoryAllocator.git
    GIT_TAG v3.0.1
)

# Lua
FetchContent_Declare(
    lua
    GIT_REPOSITORY https://github.com/lua/lua.git
    GIT_TAG v5.4.6
)

# sol2 (Lua binding)
FetchContent_Declare(
    sol2
    GIT_REPOSITORY https://github.com/ThePhD/sol2.git
    GIT_TAG v3.3.0
)

# IXWebSocket (WebSocket library for IPC)
FetchContent_Declare(
    ixwebsocket
    GIT_REPOSITORY https://github.com/machinezone/IXWebSocket.git
    GIT_TAG v11.4.5
)
set(USE_TLS OFF CACHE BOOL "" FORCE)   # Disable TLS for simplicity
set(USE_ZLIB OFF CACHE BOOL "" FORCE)  # Disable compression (avoids zlib dependency)

# nlohmann/json (JSON parsing)
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)

FetchContent_MakeAvailable(glfw glm spdlog vma ixwebsocket nlohmann_json)

# Find Vulkan SDK
find_package(Vulkan REQUIRED)

# Check Vulkan version
if(Vulkan_FOUND)
    message(STATUS "Vulkan found: ${Vulkan_LIBRARY}")
    message(STATUS "Vulkan include: ${Vulkan_INCLUDE_DIRS}")
endif()

# Collect source files
file(GLOB_RECURSE SOURCES
    "src/*.cpp"
    "src/*.hpp"
)

# Main executable
add_executable(${PROJECT_NAME} ${SOURCES})

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${Vulkan_INCLUDE_DIRS}
    ${vma_SOURCE_DIR}/include
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    Vulkan::Vulkan
    glfw
    glm::glm
    spdlog::spdlog
    ixwebsocket
    nlohmann_json::nlohmann_json
)

# Copy Lua scripts to build directory
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${CMAKE_SOURCE_DIR}/lua
    $<TARGET_FILE_DIR:${PROJECT_NAME}>/lua
)

# Compile shaders
find_program(GLSLC glslc HINTS $ENV{VULKAN_SDK}/Bin)

if(GLSLC)
    message(STATUS "Found glslc: ${GLSLC}")

    file(GLOB_RECURSE SHADER_SOURCES
        "shaders/*.vert"
        "shaders/*.frag"
        "shaders/*.rgen"
        "shaders/*.rchit"
        "shaders/*.rmiss"
        "shaders/*.comp"
    )

    set(SHADER_OUTPUT_DIR ${CMAKE_BINARY_DIR}/shaders)
    file(MAKE_DIRECTORY ${SHADER_OUTPUT_DIR})

    foreach(SHADER ${SHADER_SOURCES})
        get_filename_component(SHADER_NAME ${SHADER} NAME)
        set(SHADER_OUTPUT ${SHADER_OUTPUT_DIR}/${SHADER_NAME}.spv)

        add_custom_command(
            OUTPUT ${SHADER_OUTPUT}
            COMMAND ${GLSLC} --target-env=vulkan1.2 -o ${SHADER_OUTPUT} ${SHADER}
            DEPENDS ${SHADER}
            COMMENT "Compiling ${SHADER_NAME}"
        )

        list(APPEND SHADER_OUTPUTS ${SHADER_OUTPUT})
    endforeach()

    add_custom_target(shaders ALL DEPENDS ${SHADER_OUTPUTS})
    add_dependencies(${PROJECT_NAME} shaders)

    # Copy compiled shaders to executable directory
    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${SHADER_OUTPUT_DIR}
        $<TARGET_FILE_DIR:${PROJECT_NAME}>/shaders
    )
else()
    message(WARNING "glslc not found. Shaders will not be compiled.")
endif()

# Platform-specific settings
if(WIN32)
    target_compile_definitions(${PROJECT_NAME} PRIVATE
        VK_USE_PLATFORM_WIN32_KHR
        NOMINMAX
        WIN32_LEAN_AND_MEAN
    )
    # Use Windows subsystem (no console window) but keep main() entry point
    set_target_properties(${PROJECT_NAME} PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
    # Link with main() entry point (not WinMain)
    target_link_options(${PROJECT_NAME} PRIVATE /ENTRY:mainCRTStartup)
elseif(UNIX AND NOT APPLE)
    target_compile_definitions(${PROJECT_NAME} PRIVATE
        VK_USE_PLATFORM_XCB_KHR
    )
endif()

# Debug/Release settings
target_compile_definitions(${PROJECT_NAME} PRIVATE
    $<$<CONFIG:Debug>:DEBUG_BUILD>
    $<$<CONFIG:Release>:NDEBUG>
)

# Enable more verbose output for debugging
target_compile_definitions(${PROJECT_NAME} PRIVATE
    SPDLOG_ACTIVE_LEVEL=SPDLOG_LEVEL_DEBUG
)
