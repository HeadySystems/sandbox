// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: apps/hive/src/governance.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const streamPath = '/shared/state/lens_stream.json';
const configPath = '/shared/config/hive_config.json';
const { withFileLock, readJsonFile, writeJsonAtomic } = require('./state_store');
const determinism = require('./determinism');

class Governance {
    constructor(agentName) { this.agentName = agentName; }

    getConfig() {
        return readJsonFile(configPath, {});
    }

    log(type, message) {
        const evt = { id: Number(determinism.nextId('lens_event')), timestamp: new Date().toISOString(), source: this.agentName, type, message };
        try {
            withFileLock(streamPath, () => {
                let data = readJsonFile(streamPath, { stream_metadata: {}, events: [] });
                if (!data || typeof data !== 'object') {
                    data = { stream_metadata: {}, events: [] };
                }
                if (Array.isArray(data)) {
                    data = { 
                        stream_metadata: { version: "1.0", migrated: new Date().toISOString() },
                        events: data
                    };
                }
                if (!data.events || !Array.isArray(data.events)) data.events = [];
                if (!data.stream_metadata || typeof data.stream_metadata !== 'object' || Array.isArray(data.stream_metadata)) {
                    data.stream_metadata = {};
                }

                data.events.unshift(evt);
                data.events = data.events.slice(0, 100);

                writeJsonAtomic(streamPath, data);
            });
        } catch(e) {
            console.error('[GOVERNANCE] Log Error:', e.message);
        }
    }
}
module.exports = Governance;
