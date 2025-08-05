export const baseHlxTemplate = {
  "data": {
    "meta": {
      "name": "",
      "application": "HX Edit",
      "build_sha": "d972399",
      "modifieddate": 0,
      "appversion": 58851328
    },
    "device": 2162693,
    "tone": {
      "variax": {
        "@variax_model": 0,
        "@variax_str4tuning": 0,
        "@variax_str1tuning": 0,
        "@variax_lockctrls": 0,
        "@variax_str2tuning": 0,
        "@variax_customtuning": true,
        "@variax_magmode": false,
        "@variax_str5tuning": 0,
        "@variax_toneknob": -0.10000002384185791,
        "@variax_str3tuning": 0,
        "@variax_str6tuning": 0,
        "@variax_volumeknob": -0.10000002384185791
      },
      "dsp0": {
        "split": {
          "@model": "HD2_AppDSPFlowSplitY",
          "BalanceA": 0.5,
          "@no_snapshot_bypass": false,
          "bypass": false,
          "@position": 0,
          "@enabled": true,
          "BalanceB": 0.5
        },
        "join": {
          "@model": "HD2_AppDSPFlowJoin",
          "B Pan": 0.5,
          "@no_snapshot_bypass": false,
          "B Level": 0,
          "A Level": 0,
          "A Pan": 0.5,
          "@position": 9,
          "Level": 0,
          "@enabled": true,
          "B Polarity": false
        },
        "inputA": {
          "@input": 1,
          "@model": "HelixFx_AppDSPFlowInput"
        },
        "inputB": {
          "@input": 0,
          "@model": "HelixFx_AppDSPFlowInput"
        },
        "outputA": {
          "@model": "HelixFx_AppDSPFlowOutput",
          "@output": 1,
          "pan": 0.5,
          "gain": 0
        },
        "outputB": {
          "@model": "HelixFx_AppDSPFlowOutput",
          "@output": 0,
          "pan": 0.5,
          "gain": 0
        }
      },
      "global": {
        "@PowercabVoicing": 0,
        "@model": "@global_params",
        "@topology0": "A",
        "@cursor_dsp": 0,
        "@PowercabMode": 0,
        "@guitarpad": 0,
        "@pedalstate": 0,
        "@cursor_group": "block0",
        "@DtSelect": 2,
        "@cursor_path": 0,
        "@current_snapshot": 0,
        "@tempo": 140,
        "@cursor_position": 1,
        "@topology1": 0,
        "@PowercabSelect": 2,
        "@guitarinputZ": 0
      }
    },
    "device_version": 58720256
  },
  "meta": {
    "original": 0,
    "pbn": 0,
    "premium": 0
  },
  "schema": "L6Preset",
  "version": 6
};
