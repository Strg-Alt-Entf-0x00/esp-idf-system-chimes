// Embedded Presets Library
    const PROTOCOL_SIGNATURE = "ESP32_SYSTEM_CHIMES_V2";
    const BUNDLED_PRESETS = {
  "attention.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Attention Pulse",
      "slot_id": "ATTENTION",
      "total_duration_ms": 570,
      "created": "2026-11-07T19:27:30.135550",
      "modified": "2026-11-07T19:27:30.135573"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 25
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Square 01",
        "waveform": "SQUARE",
        "volume": 0.62,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 2,
          "decay_ms": 18,
          "sustain": 0.3,
          "release_ms": 35
        },
        "notes": [
          {
            "id": "b839c3a3-5965-4abb-92a5-6a12a3a24046",
            "frequency_hz": 659.2551138257398,
            "start_time_ms": 0,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 18,
              "sustain": 0.3,
              "release_ms": 35
            }
          },
          {
            "id": "a772a187-bd57-44e0-9909-5e42e958f324",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 200,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 18,
              "sustain": 0.3,
              "release_ms": 35
            }
          },
          {
            "id": "d49567f1-24a1-4f16-97ec-fc0c4c714285",
            "frequency_hz": 659.2551138257398,
            "start_time_ms": 400,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 18,
              "sustain": 0.3,
              "release_ms": 35
            }
          }
        ]
      },
      {
        "layer_id": 2,
        "name": "Noise 02",
        "waveform": "NOISE",
        "volume": 0.16,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 1,
          "decay_ms": 20,
          "sustain": 0.15,
          "release_ms": 90
        },
        "notes": [
          {
            "id": "9501da23-2559-4037-9898-2d862ff918d1",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 10,
            "duration_ms": 560,
            "adsr": {
              "attack_ms": 1,
              "decay_ms": 20,
              "sustain": 0.15,
              "release_ms": 90
            }
          }
        ]
      }
    ]
  },
  "battery_low.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Low Battery",
      "slot_id": "BATTERY_LOW",
      "total_duration_ms": 610,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.85,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Battery Alert",
        "waveform": "TRIANGLE",
        "volume": 0.65,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 40,
          "sustain": 0.45,
          "release_ms": 75
        },
        "notes": [
          {
            "id": "30000000-0000-4000-8000-000000000001",
            "frequency_hz": 783.99,
            "start_time_ms": 0,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 40,
              "sustain": 0.45,
              "release_ms": 75
            }
          },
          {
            "id": "30000000-0000-4000-8000-000000000002",
            "frequency_hz": 659.25,
            "start_time_ms": 220,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 40,
              "sustain": 0.45,
              "release_ms": 75
            }
          },
          {
            "id": "30000000-0000-4000-8000-000000000003",
            "frequency_hz": 523.25,
            "start_time_ms": 440,
            "duration_ms": 170,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 40,
              "sustain": 0.45,
              "release_ms": 75
            }
          }
        ]
      }
    ]
  },
  "clock_hourly.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Hourly Clock Chime",
      "slot_id": "CLOCK_HOUR",
      "total_duration_ms": 1160,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Clock Chime",
        "waveform": "SINE",
        "volume": 0.72,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 12,
          "decay_ms": 60,
          "sustain": 0.52,
          "release_ms": 180
        },
        "notes": [
          {
            "id": "60000000-0000-4000-8000-000000000001",
            "frequency_hz": 659.25,
            "start_time_ms": 0,
            "duration_ms": 220,
            "adsr": {
              "attack_ms": 12,
              "decay_ms": 60,
              "sustain": 0.52,
              "release_ms": 180
            }
          },
          {
            "id": "60000000-0000-4000-8000-000000000002",
            "frequency_hz": 783.99,
            "start_time_ms": 300,
            "duration_ms": 220,
            "adsr": {
              "attack_ms": 12,
              "decay_ms": 60,
              "sustain": 0.52,
              "release_ms": 180
            }
          },
          {
            "id": "60000000-0000-4000-8000-000000000003",
            "frequency_hz": 587.33,
            "start_time_ms": 620,
            "duration_ms": 220,
            "adsr": {
              "attack_ms": 12,
              "decay_ms": 60,
              "sustain": 0.52,
              "release_ms": 180
            }
          },
          {
            "id": "60000000-0000-4000-8000-000000000004",
            "frequency_hz": 880,
            "start_time_ms": 940,
            "duration_ms": 220,
            "adsr": {
              "attack_ms": 12,
              "decay_ms": 60,
              "sustain": 0.52,
              "release_ms": 180
            }
          }
        ]
      }
    ]
  },
  "critical_temperature.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Critical Temperature",
      "slot_id": "TEMP_CRIT",
      "total_duration_ms": 820,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.8,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Critical Thermal Alert",
        "waveform": "SAWTOOTH",
        "volume": 0.42,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 2,
          "decay_ms": 30,
          "sustain": 0.35,
          "release_ms": 60
        },
        "notes": [
          {
            "id": "50000000-0000-4000-8000-000000000001",
            "frequency_hz": 1046.5,
            "start_time_ms": 0,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 30,
              "sustain": 0.35,
              "release_ms": 60
            }
          },
          {
            "id": "50000000-0000-4000-8000-000000000002",
            "frequency_hz": 783.99,
            "start_time_ms": 250,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 30,
              "sustain": 0.35,
              "release_ms": 60
            }
          },
          {
            "id": "50000000-0000-4000-8000-000000000003",
            "frequency_hz": 523.25,
            "start_time_ms": 510,
            "duration_ms": 310,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 30,
              "sustain": 0.35,
              "release_ms": 60
            }
          }
        ]
      }
    ]
  },
  "low_confirm.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Low Confirm",
      "slot_id": "LOW_CONFIRM",
      "total_duration_ms": 320,
      "created": "2026-11-07T19:27:30.139807",
      "modified": "2026-11-07T19:27:30.139824"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 25
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Sawtooth 01",
        "waveform": "SAWTOOTH",
        "volume": 0.48,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 3,
          "decay_ms": 30,
          "sustain": 0.38,
          "release_ms": 45
        },
        "notes": [
          {
            "id": "00a16e76-a807-4a56-94e7-1743aa179c89",
            "frequency_hz": 261.6255653005986,
            "start_time_ms": 0,
            "duration_ms": 320,
            "adsr": {
              "attack_ms": 3,
              "decay_ms": 30,
              "sustain": 0.38,
              "release_ms": 45
            }
          }
        ]
      },
      {
        "layer_id": 2,
        "name": "Sine 02",
        "waveform": "SINE",
        "volume": 0.26,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 35,
          "sustain": 0.3,
          "release_ms": 40
        },
        "notes": [
          {
            "id": "2ca06b62-22fb-4084-ae30-b81910b62552",
            "frequency_hz": 391.99543598174927,
            "start_time_ms": 20,
            "duration_ms": 280,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 35,
              "sustain": 0.3,
              "release_ms": 40
            }
          }
        ]
      }
    ]
  },
  "network_connected.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Network Connected",
      "slot_id": "NETWORK_UP",
      "total_duration_ms": 320,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Connected",
        "waveform": "SINE",
        "volume": 0.7,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 8,
          "decay_ms": 35,
          "sustain": 0.55,
          "release_ms": 65
        },
        "notes": [
          {
            "id": "10000000-0000-4000-8000-000000000001",
            "frequency_hz": 587.33,
            "start_time_ms": 0,
            "duration_ms": 125,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.55,
              "release_ms": 65
            }
          },
          {
            "id": "10000000-0000-4000-8000-000000000002",
            "frequency_hz": 783.99,
            "start_time_ms": 170,
            "duration_ms": 150,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.55,
              "release_ms": 65
            }
          }
        ]
      }
    ]
  },
  "network_disconnected.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Network Disconnected",
      "slot_id": "NETWORK_DOWN",
      "total_duration_ms": 320,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Disconnected",
        "waveform": "TRIANGLE",
        "volume": 0.65,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 45,
          "sustain": 0.5,
          "release_ms": 75
        },
        "notes": [
          {
            "id": "20000000-0000-4000-8000-000000000001",
            "frequency_hz": 783.99,
            "start_time_ms": 0,
            "duration_ms": 125,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.5,
              "release_ms": 75
            }
          },
          {
            "id": "20000000-0000-4000-8000-000000000002",
            "frequency_hz": 587.33,
            "start_time_ms": 170,
            "duration_ms": 150,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.5,
              "release_ms": 75
            }
          }
        ]
      }
    ]
  },
  "retro_puzzle.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Original Retro Puzzle Melody",
      "slot_id": "RETRO_PUZZLE",
      "total_duration_ms": 12722,
      "created": "2026-11-07T19:27:30.122438",
      "modified": "2026-11-07T19:27:30.122549"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 108,
      "snap_enabled": true,
      "grid_resolution_ms": 25
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Square 01",
        "waveform": "SQUARE",
        "volume": 0.72,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 8,
          "decay_ms": 35,
          "sustain": 0.58,
          "release_ms": 40
        },
        "notes": [
          {
            "id": "cd19a200-0c35-436b-89fc-5379f2c97f2a",
            "frequency_hz": 587.3295358348151,
            "start_time_ms": 0,
            "duration_ms": 400,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "93b71b06-9e5b-44b6-babc-05934f78e334",
            "frequency_hz": 698.4564628660078,
            "start_time_ms": 417,
            "duration_ms": 178,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "0ba38a24-4db7-4593-ad63-b2174deade56",
            "frequency_hz": 783.9908719634985,
            "start_time_ms": 611,
            "duration_ms": 306,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "79c67ce2-fdf0-4acb-a42e-59c0db0419ae",
            "frequency_hz": 880.0,
            "start_time_ms": 972,
            "duration_ms": 189,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "5cc3a031-5fd7-41c6-a57d-d0c6275f0d6d",
            "frequency_hz": 783.9908719634985,
            "start_time_ms": 1183,
            "duration_ms": 378,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "d58adc18-9286-4a86-a2f7-debca38d1eed",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 1667,
            "duration_ms": 233,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "6d902a5e-7ec0-4ea2-a9ac-0a7a5c2e7a6c",
            "frequency_hz": 587.3295358348151,
            "start_time_ms": 1933,
            "duration_ms": 189,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "14f96e82-9d6c-4b5c-9002-bba283b0bcc0",
            "frequency_hz": 698.4564628660078,
            "start_time_ms": 2144,
            "duration_ms": 417,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "377772c3-1150-4510-8d5d-c20b2b2b84d7",
            "frequency_hz": 659.2551138257398,
            "start_time_ms": 2622,
            "duration_ms": 194,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "8303d50b-d4ce-45e1-8c91-10cf6923288f",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 2822,
            "duration_ms": 233,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "3e9640a6-ee15-438e-9011-abb0f43d0c6b",
            "frequency_hz": 587.3295358348151,
            "start_time_ms": 3083,
            "duration_ms": 361,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "58353ecf-2aa9-40a5-9bdd-b1717f3f5435",
            "frequency_hz": 440.0,
            "start_time_ms": 3528,
            "duration_ms": 167,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "5d8d26fb-1c9b-464b-9bdc-19af3effa85b",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 3722,
            "duration_ms": 289,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "1edcc302-ca79-4ea8-9112-10b767d81b38",
            "frequency_hz": 698.4564628660078,
            "start_time_ms": 4044,
            "duration_ms": 194,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "26174a44-ee8b-4e35-b2f0-710bfa1c231f",
            "frequency_hz": 659.2551138257398,
            "start_time_ms": 4267,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "17ca8b5c-a5da-437f-a057-3fa88d796fc8",
            "frequency_hz": 587.3295358348151,
            "start_time_ms": 4567,
            "duration_ms": 411,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "0e7eab97-78dd-498b-975d-4b4bf8687327",
            "frequency_hz": 440.0,
            "start_time_ms": 5028,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "0e874724-f7f2-405b-9021-cb11898758bc",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 5267,
            "duration_ms": 511,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "4f3f57b9-6460-4bd7-9f84-9fd9bb4fb836",
            "frequency_hz": 587.3295358348151,
            "start_time_ms": 5822,
            "duration_ms": 200,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "f4028ac4-ce81-49c8-8bcb-792523f05c04",
            "frequency_hz": 698.4564628660078,
            "start_time_ms": 6044,
            "duration_ms": 278,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          },
          {
            "id": "741ec616-78ee-404b-8a12-e6c57ba7ea9a",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 6361,
            "duration_ms": 583,
            "adsr": {
              "attack_ms": 8,
              "decay_ms": 35,
              "sustain": 0.58,
              "release_ms": 40
            }
          }
        ]
      },
      {
        "layer_id": 2,
        "name": "Triangle 02",
        "waveform": "TRIANGLE",
        "volume": 0.58,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 45,
          "sustain": 0.48,
          "release_ms": 45
        },
        "notes": [
          {
            "id": "105cbe93-1b2b-4cab-b705-17880555a623",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 0,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "acd3bfa6-8182-411b-98d1-732cf182ee3b",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 1667,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "07e83cbf-5af7-4b78-9b0d-e2311a3effe5",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 3333,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "1f59222d-246a-47b7-bbcb-eae6183eb6f1",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 5000,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "0b96861b-9184-4acb-bd97-3b00673f4223",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 6667,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "0f344464-e71f-45c6-a67b-f1ca37c31f8f",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 8333,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "52b821c1-b8e9-46b5-9c79-8e1911c4ff0f",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 10000,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          },
          {
            "id": "a939a063-3d2f-41a0-a298-5cc008afe187",
            "frequency_hz": 146.8323839587038,
            "start_time_ms": 11667,
            "duration_ms": 267,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 45,
              "sustain": 0.48,
              "release_ms": 45
            }
          }
        ]
      },
      {
        "layer_id": 3,
        "name": "Sine 03",
        "waveform": "SINE",
        "volume": 0.38,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 30,
          "sustain": 0.4,
          "release_ms": 35
        },
        "notes": [
          {
            "id": "7dd20144-b3ce-4bcb-8de2-62364a04cc3c",
            "frequency_hz": 220.0,
            "start_time_ms": 844,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "a7c3dc0d-d189-4e3a-bd3a-e90ec05bbb8f",
            "frequency_hz": 293.6647679174076,
            "start_time_ms": 2511,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "5f2c4f9a-1d05-4328-9669-f91b99aa8f17",
            "frequency_hz": 329.6275569128699,
            "start_time_ms": 4178,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "49721574-d83b-44c6-9b5d-9f2944091d2c",
            "frequency_hz": 261.6255653005986,
            "start_time_ms": 5844,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "f7955f93-1294-42cd-9491-fba3453f20a1",
            "frequency_hz": 220.0,
            "start_time_ms": 7511,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "c7cdd4d0-5fdf-4e60-919a-7396bebeac49",
            "frequency_hz": 329.6275569128699,
            "start_time_ms": 9178,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "0768fae1-ef0b-491d-8e81-9d1d184b6dbe",
            "frequency_hz": 293.6647679174076,
            "start_time_ms": 10844,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          },
          {
            "id": "d1e48bc1-8d3f-413c-87d1-0dbf19e2d75e",
            "frequency_hz": 220.0,
            "start_time_ms": 12511,
            "duration_ms": 211,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 30,
              "sustain": 0.4,
              "release_ms": 35
            }
          }
        ]
      }
    ]
  },
  "success_chime.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Success Chime",
      "slot_id": "SUCCESS_CHIME",
      "total_duration_ms": 720,
      "created": "2026-11-07T19:27:30.131412",
      "modified": "2026-11-07T19:27:30.131417"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 25
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Triangle 01",
        "waveform": "TRIANGLE",
        "volume": 0.7,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 5,
          "decay_ms": 25,
          "sustain": 0.62,
          "release_ms": 55
        },
        "notes": [
          {
            "id": "33963520-e311-4baa-87c5-b94d86a41bff",
            "frequency_hz": 523.2511306011972,
            "start_time_ms": 0,
            "duration_ms": 190,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 25,
              "sustain": 0.62,
              "release_ms": 55
            }
          },
          {
            "id": "57f47e9f-bede-4954-b624-b80e81b8e70a",
            "frequency_hz": 659.2551138257398,
            "start_time_ms": 120,
            "duration_ms": 220,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 25,
              "sustain": 0.62,
              "release_ms": 55
            }
          },
          {
            "id": "c190cdc8-f469-479f-807e-f1e0dc8c6681",
            "frequency_hz": 783.9908719634985,
            "start_time_ms": 260,
            "duration_ms": 460,
            "adsr": {
              "attack_ms": 5,
              "decay_ms": 25,
              "sustain": 0.62,
              "release_ms": 55
            }
          }
        ]
      }
    ]
  },
  "temperature_warning.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Temperature Warning",
      "slot_id": "TEMP_WARN",
      "total_duration_ms": 740,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.8,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Thermal Warning",
        "waveform": "SQUARE",
        "volume": 0.5,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 3,
          "decay_ms": 35,
          "sustain": 0.38,
          "release_ms": 55
        },
        "notes": [
          {
            "id": "40000000-0000-4000-8000-000000000001",
            "frequency_hz": 880,
            "start_time_ms": 0,
            "duration_ms": 130,
            "adsr": {
              "attack_ms": 3,
              "decay_ms": 35,
              "sustain": 0.38,
              "release_ms": 55
            }
          },
          {
            "id": "40000000-0000-4000-8000-000000000002",
            "frequency_hz": 659.25,
            "start_time_ms": 200,
            "duration_ms": 130,
            "adsr": {
              "attack_ms": 3,
              "decay_ms": 35,
              "sustain": 0.38,
              "release_ms": 55
            }
          },
          {
            "id": "40000000-0000-4000-8000-000000000003",
            "frequency_hz": 880,
            "start_time_ms": 410,
            "duration_ms": 130,
            "adsr": {
              "attack_ms": 3,
              "decay_ms": 35,
              "sustain": 0.38,
              "release_ms": 55
            }
          },
          {
            "id": "40000000-0000-4000-8000-000000000004",
            "frequency_hz": 659.25,
            "start_time_ms": 610,
            "duration_ms": 130,
            "adsr": {
              "attack_ms": 3,
              "decay_ms": 35,
              "sustain": 0.38,
              "release_ms": 55
            }
          }
        ]
      }
    ]
  },
  "ui_select.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "UI Select",
      "slot_id": "UI_SELECT",
      "total_duration_ms": 130,
      "created": "2026-11-07T19:27:30.127543",
      "modified": "2026-11-07T19:27:30.127548"
    },
    "global": {
      "master_volume": 0.9,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 25
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Sine 01",
        "waveform": "SINE",
        "volume": 0.72,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 2,
          "decay_ms": 12,
          "sustain": 0.25,
          "release_ms": 45
        },
        "notes": [
          {
            "id": "763ff1cb-1a3e-493b-a847-c1a17219600d",
            "frequency_hz": 1046.5022612023945,
            "start_time_ms": 0,
            "duration_ms": 130,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 12,
              "sustain": 0.25,
              "release_ms": 45
            }
          }
        ]
      }
    ]
  },
  "wake_alarm.chime.json": {
    "project": {
      "version": "2.1.0",
      "name": "Wake Alarm Cue",
      "slot_id": "WAKE_ALARM",
      "total_duration_ms": 1930,
      "created": "2026-11-07T00:00:00",
      "modified": "2026-11-07T00:00:00"
    },
    "global": {
      "master_volume": 0.85,
      "bpm": 120,
      "snap_enabled": true,
      "grid_resolution_ms": 10
    },
    "layers": [
      {
        "layer_id": 1,
        "name": "Alarm Cue",
        "waveform": "SQUARE",
        "volume": 0.48,
        "mute": false,
        "solo": false,
        "default_adsr": {
          "attack_ms": 2,
          "decay_ms": 45,
          "sustain": 0.3,
          "release_ms": 45
        },
        "notes": [
          {
            "id": "70000000-0000-4000-8000-000000000001",
            "frequency_hz": 783.99,
            "start_time_ms": 0,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000002",
            "frequency_hz": 987.77,
            "start_time_ms": 250,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000003",
            "frequency_hz": 783.99,
            "start_time_ms": 500,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000004",
            "frequency_hz": 987.77,
            "start_time_ms": 750,
            "duration_ms": 160,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000005",
            "frequency_hz": 1046.5,
            "start_time_ms": 1000,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000006",
            "frequency_hz": 987.77,
            "start_time_ms": 1250,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000007",
            "frequency_hz": 783.99,
            "start_time_ms": 1500,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          },
          {
            "id": "70000000-0000-4000-8000-000000000008",
            "frequency_hz": 659.25,
            "start_time_ms": 1750,
            "duration_ms": 180,
            "adsr": {
              "attack_ms": 2,
              "decay_ms": 45,
              "sustain": 0.3,
              "release_ms": 45
            }
          }
        ]
      }
    ]
  }
};

    // Constants & Colors
    const WAVEFORMS = [
      { id: 0, key: "SINE", label: "Sine", color: "#00f0ff" },
      { id: 1, key: "SQUARE", label: "Square", color: "#ffb020" },
      { id: 2, key: "TRIANGLE", label: "Triangle", color: "#00e5a3" },
      { id: 3, key: "SAWTOOTH", label: "Sawtooth", color: "#ff763b" },
      { id: 4, key: "NOISE", label: "Noise", color: "#a855f7" }
    ];

    const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const MIN_MIDI = 24;  // C1 (32.7 Hz)
    const MAX_MIDI = 108; // C8 (4186 Hz)
    const TOTAL_KEYS = MAX_MIDI - MIN_MIDI + 1;
