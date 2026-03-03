#!/bin/bash
sed -i "s/import { toggleSelectionMode, clearCircuit } from '.\/circuit.js';/import { clearCircuit } from '.\/circuit.js';\nimport { toggleSelectionMode } from '.\/ui-circuit-editor.js';/" src/desktopMode.js
sed -i "s/import { clearCircuit, navigatePoiDetails, toggleSelectionMode, loadCircuitById } from '.\/circuit.js';/import { clearCircuit, navigatePoiDetails, loadCircuitById } from '.\/circuit.js';\nimport { toggleSelectionMode } from '.\/ui-circuit-editor.js';/" src/ui.js
sed -i "s/import { navigatePoiDetails, toggleSelectionMode } from '.\/circuit.js';/import { navigatePoiDetails } from '.\/circuit.js';\nimport { toggleSelectionMode } from '.\/ui-circuit-editor.js';/" src/ui-details.js
