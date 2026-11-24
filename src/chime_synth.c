/**
 * @file chime_synth.c
 * @brief Real-time multi-layer chime synthesis engine
 */

#include "chime_synth.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "esp_log.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

static const char* TAG = "chime_synth";

/**
 * @brief Note rendering state within a layer
 */
typedef struct {
    float phase;                    // Current oscillator phase (0.0 - 1.0)
    float frequency_hz;
    uint32_t samples_rendered;      // Samples rendered for this note
    uint32_t start_sample;          // When this note starts (global time)
    uint32_t end_sample;            // When this note ends (global time)
    bool active;                    // Currently rendering
} note_state_t;

/**
 * @brief Layer rendering state
 */
typedef struct {
    note_state_t* note_states;
    float volume;                   // Layer volume
    chime_waveform_t waveform;
    chime_adsr_t adsr;
    uint8_t note_count;
} layer_state_t;

/**
 * @brief Chime synthesizer handle
 */
struct chime_handle {
    layer_state_t* layers;
    uint8_t layer_count;
    uint32_t sample_rate;
    float master_volume;
    uint32_t total_samples_rendered;
    uint32_t total_duration_samples;
    bool finished;
};

/**
 * @brief Generate waveform sample at given phase
 */
static inline float generate_waveform(chime_waveform_t type, float phase) {
    switch (type) {
        case CHIME_WAVE_SINE:
            return sinf(2.0f * M_PI * phase);
            
        case CHIME_WAVE_SQUARE:
            return (phase < 0.5f) ? 1.0f : -1.0f;
            
        case CHIME_WAVE_TRIANGLE:
            return (phase < 0.5f) ? (4.0f * phase - 1.0f) : (3.0f - 4.0f * phase);
            
        case CHIME_WAVE_SAWTOOTH:
            return 2.0f * phase - 1.0f;
            
        case CHIME_WAVE_NOISE:
            return ((float)rand() / RAND_MAX) * 2.0f - 1.0f;
            
        default:
            return 0.0f;
    }
}

/**
 * @brief Calculate ADSR envelope amplitude
 */
static inline float calculate_envelope(const chime_adsr_t* adsr, 
                                        uint32_t sample_rate,
                                        uint32_t samples_in_note) {
    uint32_t attack_samples = (uint32_t)((adsr->attack_ms / 1000.0f) * sample_rate);
    uint32_t decay_samples = (uint32_t)((adsr->decay_ms / 1000.0f) * sample_rate);
    
    uint32_t pos = samples_in_note;
    
    // Attack phase
    if (pos < attack_samples) {
        return (attack_samples > 0) ? ((float)pos / attack_samples) : 1.0f;
    }
    
    pos -= attack_samples;
    
    // Decay phase
    if (pos < decay_samples) {
        if (decay_samples == 0) return adsr->sustain_level;
        float decay_progress = (float)pos / decay_samples;
        return 1.0f - (1.0f - adsr->sustain_level) * decay_progress;
    }
    
    pos -= decay_samples;
    
    // Sustain phase (continue until release)
    // Note: Release is calculated from the END of the note, handled separately
    return adsr->sustain_level;
}

/**
 * @brief Calculate release envelope (from end of note)
 */
static inline float calculate_release(const chime_adsr_t* adsr,
                                       uint32_t sample_rate,
                                       uint32_t note_samples,
                                       uint32_t samples_remaining) {
    uint32_t release_samples = (uint32_t)((adsr->release_ms / 1000.0f) * sample_rate);
    if (release_samples > note_samples) {
        release_samples = note_samples;
    }
    
    if (samples_remaining > release_samples) {
        return 1.0f; // Not in release yet
    }
    
    if (release_samples == 0) return 1.0f;
    
    return (float)samples_remaining / release_samples;
}

esp_err_t chime_synth_create(const chime_sound_t* sound,
                              uint32_t sample_rate,
                              float master_volume,
                              chime_handle_t* handle) {
    if (!sound || !handle) {
        ESP_LOGE(TAG, "Invalid arguments");
        return ESP_ERR_INVALID_ARG;
    }

    *handle = NULL;
    if (sample_rate == 0 || !isfinite(master_volume) ||
        master_volume < 0.0f || master_volume > 1.0f ||
        sound->layer_count == 0 || sound->layer_count > CHIME_MAX_LAYERS) {
        ESP_LOGE(TAG, "Invalid sound or synthesis configuration");
        return ESP_ERR_INVALID_ARG;
    }

    uint64_t total_duration_samples =
        ((uint64_t)sound->total_duration_ms * sample_rate) / 1000U;
    if (sound->total_duration_ms == 0 || total_duration_samples > UINT32_MAX) {
        ESP_LOGE(TAG, "Sound duration cannot be represented at this sample rate");
        return ESP_ERR_INVALID_ARG;
    }

    for (uint8_t i = 0; i < sound->layer_count; i++) {
        const chime_layer_t* layer = &sound->layers[i];
        if (layer->note_count > CHIME_MAX_NOTES ||
            layer->waveform < CHIME_WAVE_SINE || layer->waveform >= CHIME_WAVE_MAX ||
            !isfinite(layer->volume) || layer->volume < 0.0f || layer->volume > 1.0f ||
            !isfinite(layer->adsr.sustain_level) ||
            layer->adsr.sustain_level < 0.0f || layer->adsr.sustain_level > 1.0f) {
            ESP_LOGE(TAG, "Invalid note count in layer %u", (unsigned)i);
            return ESP_ERR_INVALID_ARG;
        }

        for (uint8_t n = 0; n < layer->note_count; n++) {
            const chime_note_t* note = &layer->notes[n];
            uint64_t note_end_ms = (uint64_t)note->start_time_ms + note->duration_ms;
            uint64_t note_end_samples = (note_end_ms * sample_rate) / 1000U;
            if (note->duration_ms == 0 || note_end_ms > sound->total_duration_ms ||
                !isfinite(note->frequency_hz) || note->frequency_hz <= 0.0f ||
                note->frequency_hz > sample_rate / 2.0f ||
                note_end_samples > UINT32_MAX) {
                ESP_LOGE(TAG, "Invalid note %u in layer %u", (unsigned)n, (unsigned)i);
                return ESP_ERR_INVALID_ARG;
            }
        }
    }
    
    struct chime_handle* synth = calloc(1, sizeof(struct chime_handle));
    if (!synth) {
        ESP_LOGE(TAG, "Failed to allocate synth handle");
        return ESP_ERR_NO_MEM;
    }

    synth->layer_count = sound->layer_count;
    synth->sample_rate = sample_rate;
    synth->master_volume = master_volume;
    synth->total_duration_samples = (uint32_t)total_duration_samples;
    synth->finished = false;
    
    // Allocate layer states
    synth->layers = calloc(sound->layer_count, sizeof(layer_state_t));
    if (!synth->layers) {
        ESP_LOGE(TAG, "Failed to allocate layer states");
        free(synth);
        return ESP_ERR_NO_MEM;
    }
    
    // Initialize each layer
    for (uint8_t i = 0; i < sound->layer_count; i++) {
        const chime_layer_t* src_layer = &sound->layers[i];
        layer_state_t* layer = &synth->layers[i];
        
        layer->waveform = src_layer->waveform;
        layer->adsr = src_layer->adsr;
        layer->volume = src_layer->volume;
        layer->note_count = src_layer->note_count;
        
        if (src_layer->note_count == 0) continue;
        
        // Allocate note states for this layer
        layer->note_states = calloc(src_layer->note_count, sizeof(note_state_t));
        if (!layer->note_states) {
            ESP_LOGE(TAG, "Failed to allocate note states for layer %d", i);
            // Cleanup previous layers
            for (uint8_t j = 0; j < i; j++) {
                if (synth->layers[j].note_states) {
                    free(synth->layers[j].note_states);
                }
            }
            free(synth->layers);
            free(synth);
            return ESP_ERR_NO_MEM;
        }
        
        // Initialize note states
        for (uint8_t n = 0; n < src_layer->note_count; n++) {
            const chime_note_t* src_note = &src_layer->notes[n];
            note_state_t* note = &layer->note_states[n];
            
            note->phase = 0.0f;
            note->frequency_hz = src_note->frequency_hz;
            note->samples_rendered = 0;
            note->start_sample = (uint32_t)(((uint64_t)src_note->start_time_ms * sample_rate) / 1000U);
            note->end_sample = (uint32_t)(((uint64_t)(src_note->start_time_ms + (uint64_t)src_note->duration_ms) *
                                           sample_rate) / 1000U);
            note->active = false;
        }
    }
    
    *handle = synth;
    ESP_LOGI(TAG, "Created synth (%lu ms, %d layers, %lu samples @ %lu Hz)", 
             sound->total_duration_ms, sound->layer_count, 
             synth->total_duration_samples, sample_rate);
    
    return ESP_OK;
}

esp_err_t chime_synth_render(chime_handle_t handle,
                              int16_t* buffer,
                              size_t buffer_size,
                              size_t* samples_rendered) {
    if (!handle || !buffer) {
        return ESP_ERR_INVALID_ARG;
    }
    
    if (handle->finished) {
        if (samples_rendered) *samples_rendered = 0;
        return ESP_ERR_INVALID_STATE;
    }
    
    memset(buffer, 0, buffer_size * sizeof(int16_t));
    
    // Render each sample
    for (size_t s = 0; s < buffer_size; s++) {
        uint64_t global_time = (uint64_t)handle->total_samples_rendered + s;
        
        // Check if we've reached the end
        if (global_time >= handle->total_duration_samples) {
            handle->finished = true;
            if (samples_rendered) *samples_rendered = s;
            return ESP_OK;
        }
        
        float mixed = 0.0f;
        
        // Mix all layers
        for (uint8_t l = 0; l < handle->layer_count; l++) {
            layer_state_t* layer = &handle->layers[l];
            
            if (layer->note_count == 0) continue;
            
            // Check each note in this layer
            for (uint8_t n = 0; n < layer->note_count; n++) {
                note_state_t* note = &layer->note_states[n];
                
                // Activate note if time has come
                if (!note->active && global_time >= note->start_sample && 
                    global_time < note->end_sample) {
                    note->active = true;
                    note->samples_rendered = 0;
                    note->phase = 0.0f;
                }
                
                if (!note->active) continue;
                
                // Deactivate if note finished
                if (global_time >= note->end_sample) {
                    note->active = false;
                    continue;
                }
                
                // Generate waveform
                float wave = generate_waveform(layer->waveform, note->phase);
                
                // Calculate envelope
                uint32_t samples_in_note = note->samples_rendered;
                uint32_t samples_remaining = note->end_sample - global_time;
                
                float attack_decay_sustain = calculate_envelope(&layer->adsr, 
                                                                  handle->sample_rate, 
                                                                  samples_in_note);
                float release = calculate_release(&layer->adsr, 
                                                   handle->sample_rate, 
                                                   note->end_sample - note->start_sample,
                                                   samples_remaining);
                
                float envelope = attack_decay_sustain * release;
                
                // Apply layer volume
                float output = wave * envelope * layer->volume;
                
                // Mix into buffer
                mixed += output;
                
                // Advance phase
                float phase_increment = note->frequency_hz / handle->sample_rate;
                note->phase += phase_increment;
                if (note->phase >= 1.0f) {
                    note->phase -= 1.0f;
                }
                
                note->samples_rendered++;
            }
        }
        
        // Apply master volume
        mixed *= handle->master_volume;
        
        // Clamp and convert to int16
        mixed = fmaxf(-1.0f, fminf(1.0f, mixed));
        buffer[s] = (int16_t)(mixed * 32767.0f);
    }
    
    handle->total_samples_rendered += buffer_size;
    
    if (samples_rendered) {
        *samples_rendered = buffer_size;
    }
    
    return ESP_OK;
}

bool chime_synth_is_finished(chime_handle_t handle) {
    return handle ? handle->finished : true;
}

esp_err_t chime_synth_destroy(chime_handle_t handle) {
    if (!handle) {
        return ESP_ERR_INVALID_ARG;
    }
    
    // Free note states in each layer
    if (handle->layers) {
        for (uint8_t i = 0; i < handle->layer_count; i++) {
            if (handle->layers[i].note_states) {
                free(handle->layers[i].note_states);
            }
        }
        free(handle->layers);
    }
    
    free(handle);
    
    ESP_LOGD(TAG, "Destroyed synth");
    return ESP_OK;
}
