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
// ║  FILE: apps/hive/src/heady_refiner.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const CONTEXTS = [
    {
        key: 'TOPOLOGY_MAPPING',
        option: 'A',
        label: 'Topology Mapping',
        selector_text: "CONTEXT: TOPOLOGY_MAPPING. Task: Initialize a Transformer model (all-MiniLM-L6-v2). Generate 1,000 synthetic nodes. Use the GPU to batch-process payloads into 'Context Vectors.' Calculate the Cosine Similarity matrix to find which nodes are logically related."
    },
    {
        key: 'SANITY_STRESS_TEST',
        option: 'B',
        label: 'Sanity Stress Test',
        selector_text: "CONTEXT: SANITY_STRESS_TEST. Task: Ingest 100,000 synthetic logs. Use GPU Tensors to compare 'Anchor_Time' vs 'Ingest_Time.' Create a Boolean Mask to instantly flag any node with a 'Drift' > 24 hours. Output the count of 'Corrupted Nodes'."
    },
    {
        key: 'CHRONOLOGICAL_ORDERING',
        option: 'C',
        label: 'Chronological Ordering',
        selector_text: 'CONTEXT: CHRONOLOGICAL_ORDERING. Task: Generate 500,000 nodes with scrambled timestamps. Use torch.sort (or argsort) to re-order them by Anchor Time on the GPU. Measure the time difference between CPU sort and GPU sort.'
    }
];

function normalizeContext(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const upper = raw.toUpperCase();
    if (upper === 'A') return 'TOPOLOGY_MAPPING';
    if (upper === 'B') return 'SANITY_STRESS_TEST';
    if (upper === 'C') return 'CHRONOLOGICAL_ORDERING';

    if (upper.includes('TOPOLOGY')) return 'TOPOLOGY_MAPPING';
    if (upper.includes('SANITY')) return 'SANITY_STRESS_TEST';
    if (upper.includes('CHRONO')) return 'CHRONOLOGICAL_ORDERING';
    if (upper.includes('ORDERING') || upper.includes('SORT')) return 'CHRONOLOGICAL_ORDERING';

    const direct = CONTEXTS.find(c => c.key === upper);
    return direct ? direct.key : null;
}

function contextSelectorText(contextInput) {
    const key = normalizeContext(contextInput);
    if (!key) return null;
    const ctx = CONTEXTS.find(c => c.key === key);
    return ctx ? ctx.selector_text : null;
}

function handshakeScript() {
    return `import torch
print(f"Heady Compute Node: {'ONLINE' if torch.cuda.is_available() else 'OFFLINE'}")
if torch.cuda.is_available():
    print(f"Device: {torch.cuda.get_device_name(0)}")
`;
}

function masterPrompt(contextInput) {
    const injected = contextSelectorText(contextInput);
    const selector = injected || '[INSERT CONTEXT HERE - SEE OPTIONS BELOW]';

    return `ACTIVATE MODE: GPU_SYSTEMS_ENGINEER

I need to generate a Python script for Google Colab to execute a task for Project Heady.

**The Context Selector:**
I am optimizing for: ${selector}

**The Constraints:**
1.  **GPU Utilization:** The code must check for \`torch.cuda.is_available()\` and move all Tensors to \`.to('cuda')\`.
2.  **Schema Compliance:** Use the 'Heady Node' JSON structure (Anchor Time, Context Vector, Payload) defined in Part XVII.
3.  **Vectorization:** Do not use 'for loops'. Use Matrix Operations (Tensor Math) for speed.
4.  **Mock Data:** Include a generator function to create dummy data so I can test the logic immediately.

**Output:**
Provide the complete, copy-pasteable Python code block.
`;
}

function bootstrapScript() {
    return `# HEADY PROJECT: SILICON REFINERY BOOTSTRAP
# -------------------------------------------
# Installs dependencies and sets up the 'HeadyNode' class on GPU

# 1. INSTALL
!pip install -q sentence-transformers

# 2. IMPORT & SETUP
import torch
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from datetime import datetime, timedelta

# 3. DETECT HARDWARE
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"🚀 HEADY ENGINE INITIALIZED ON: {device.upper()}")

# 4. DEFINE THE "HEADY NODE" (GPU Optimized)
class HeadyBatchProcessor:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

    def ingest_and_vectorize(self, text_payloads):
        """
        Takes a list of text strings and converts them to
        Logic Vectors using the GPU.
        """
        print(f"⚡ Processing {len(text_payloads)} nodes...")
        embeddings = self.model.encode(text_payloads, convert_to_tensor=True, device=device)
        return embeddings

    def check_sanity(self, anchor_times, ingest_times):
        """
        Checks for Time Drift using Tensor Math (No Loops).
        """
        anchors = torch.tensor(anchor_times, device=device)
        ingests = torch.tensor(ingest_times, device=device)
        deltas = ingests - anchors
        return deltas

# 5. READY
processor = HeadyBatchProcessor()
print("✅ System Ready. Paste your specific logic script below.")
`;
}

function topologyMappingScript() {
    return `
# CONTEXT: TOPOLOGY_MAPPING
import torch
import pandas as pd

n_nodes = 1000

anchor_base = int(datetime.utcnow().timestamp())
anchor_offsets = torch.randint(0, 3600 * 24, (n_nodes,), dtype=torch.int64)
anchor_times = (torch.tensor(anchor_base, dtype=torch.int64) + anchor_offsets).tolist()

idx = pd.Series(range(n_nodes), dtype='int64')
payloads = ("Synthetic node payload " + idx.astype(str)).tolist()

nodes_df = pd.DataFrame({
    'Anchor_Time': anchor_times,
    'Payload': payloads
})

with torch.no_grad():
    embeddings = processor.ingest_and_vectorize(payloads)

embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
similarity = embeddings @ embeddings.T

k = 6
values, indices = torch.topk(similarity, k=k, dim=1)

print('Similarity matrix shape:', tuple(similarity.shape))
print('Top related indices for node 0 (including self):', indices[0].detach().cpu().numpy())

nodes_preview = nodes_df.head(3).to_dict(orient='records')
print('Schema preview (Heady Node-style):')
print(nodes_preview)
`;
}

function sanityStressTestScript() {
    return `
# CONTEXT: SANITY_STRESS_TEST
import torch

n_logs = 100000
seconds_in_day = 24 * 3600

anchors = torch.randint(1_700_000_000, 1_700_000_000 + (30 * seconds_in_day), (n_logs,), device=device, dtype=torch.int64)

base_drift = torch.randint(0, 48 * 3600, (n_logs,), device=device, dtype=torch.int64)
ingests = anchors + base_drift

drift_seconds = ingests - anchors
mask_corrupted = drift_seconds > seconds_in_day
corrupted_count = int(mask_corrupted.sum().item())

print('Corrupted Nodes (Drift > 24h):', corrupted_count)

sample = {
    'Anchor_Time': int(anchors[0].item()),
    'Ingest_Time': int(ingests[0].item()),
    'Payload': 'synthetic_log_0',
    'Context_Vector': None
}
print('Schema preview (single node):')
print(sample)
`;
}

function chronologicalOrderingScript() {
    return `
# CONTEXT: CHRONOLOGICAL_ORDERING
import torch
import time

n_nodes = 500000

anchor_cpu = torch.randint(1_700_000_000, 1_700_000_000 + 1_000_000, (n_nodes,), device='cpu', dtype=torch.int64)

t0 = time.perf_counter()
_ = torch.sort(anchor_cpu)
t1 = time.perf_counter()

cpu_ms = (t1 - t0) * 1000.0
print(f'CPU sort: {cpu_ms:.2f} ms')

if device != 'cuda':
    print('GPU sort skipped (CUDA not available).')
else:
    anchor_gpu = anchor_cpu.to(device)
    torch.cuda.synchronize()
    t2 = time.perf_counter()
    _ = torch.sort(anchor_gpu)
    torch.cuda.synchronize()
    t3 = time.perf_counter()

    gpu_ms = (t3 - t2) * 1000.0
    print(f'GPU sort: {gpu_ms:.2f} ms')
    print(f'Speedup: {cpu_ms / max(gpu_ms, 1e-9):.2f}x')
`;
}

function contextScript(contextInput) {
    const key = normalizeContext(contextInput);
    if (!key) return null;

    if (key === 'TOPOLOGY_MAPPING') {
        return `${bootstrapScript()}${topologyMappingScript()}`;
    }

    if (key === 'SANITY_STRESS_TEST') {
        return `${bootstrapScript()}${sanityStressTestScript()}`;
    }

    if (key === 'CHRONOLOGICAL_ORDERING') {
        return `${bootstrapScript()}${chronologicalOrderingScript()}`;
    }

    return null;
}

module.exports = {
    contexts: () => CONTEXTS.map(c => ({ key: c.key, option: c.option, label: c.label, selector_text: c.selector_text })),
    normalizeContext,
    contextSelectorText,
    handshakeScript,
    masterPrompt,
    bootstrapScript,
    contextScript
};
