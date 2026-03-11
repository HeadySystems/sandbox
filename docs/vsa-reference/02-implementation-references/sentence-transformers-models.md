# Sentence-Transformers Models for Heady™

## Overview

Sentence-Transformers provides pre-trained models for generating dense vector embeddings of sentences, paragraphs, and documents.

## Recommended Models for Heady™

### 1. all-MiniLM-L12-v2 (Primary Choice)

**Specs:**
- Dimensions: 384
- Model size: 120MB
- Speed: ~14,000 sentences/sec on GPU, ~700 sentences/sec on CPU
- Performance: 0.83 avg on STS benchmark

**Why this matches Heady spec:**
- 384 dimensions exactly matches your DEFAULT_DIM [file:1]
- Fast inference for real-time agent memory
- Good balance of quality and speed
- Widely used and tested

**Hugging Face:**
```
sentence-transformers/all-MiniLM-L12-v2
```

**Usage:**
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('sentence-transformers/all-MiniLM-L12-v2')
embeddings = model.encode([
    "This is a sample sentence",
    "Each sentence becomes a 384-dim vector"
])

print(embeddings.shape)  # (2, 384)
```

### 2. all-mpnet-base-v2 (Higher Quality)

**Specs:**
- Dimensions: 768
- Model size: 420MB
- Speed: ~2,800 sentences/sec on GPU
- Performance: 0.86 avg on STS benchmark

**Trade-offs:**
- Higher accuracy (+3% over MiniLM)
- 2× dimensions = 2× memory usage
- Slower inference

**When to use:**
- Quality-critical applications
- When you can afford higher compute cost
- Batch processing scenarios

### 3. all-MiniLM-L6-v2 (Fastest)

**Specs:**
- Dimensions: 384
- Model size: 80MB
- Speed: ~30,000 sentences/sec on GPU
- Performance: 0.80 avg on STS benchmark

**Trade-offs:**
- Fastest inference
- Smallest model size
- Slightly lower quality (-3% vs L12)

**When to use:**
- Extreme latency requirements
- Edge deployment
- High-throughput scenarios

## Integration with Heady™ Vector Memory

```javascript
// Node.js integration via Python bridge or ONNX runtime

class HeadyEmbedder {
  constructor(modelName = 'all-MiniLM-L12-v2') {
    this.modelName = modelName;
    this.dimensions = 384;  // For MiniLM models
    // Initialize Python bridge or ONNX runtime
  }

  async embed(text) {
    // Call embedding model
    const embedding = await this.callModel(text);
    return new Float64Array(embedding);  // Convert to typed array
  }

  async embedBatch(texts) {
    // Batch embedding for efficiency
    const embeddings = await this.callModelBatch(texts);
    return embeddings.map(e => new Float64Array(e));
  }
}

// Usage in vector memory
const embedder = new HeadyEmbedder();
const vectorMemory = new VectorMemory({
  dimensions: 384,
  embedFn: async (text) => embedder.embed(text)
});

// Store text with automatic embedding
await vectorMemory.storeText('user-msg-1', 'Hello, how are you?', { role: 'user' });

// Search with automatic embedding
const results = await vectorMemory.searchText('greeting', 5);
```

## Model Comparison Table

| Model | Dimensions | Size | Speed (CPU) | STS Score | Use Case |
|-------|------------|------|-------------|-----------|----------|
| all-MiniLM-L6-v2 | 384 | 80MB | 30K sent/s | 0.80 | Speed-critical |
| all-MiniLM-L12-v2 | 384 | 120MB | 14K sent/s | 0.83 | **Recommended** |
| all-mpnet-base-v2 | 768 | 420MB | 2.8K sent/s | 0.86 | Quality-critical |
| all-MiniLM-L6-v2 | 384 | 80MB | 30K sent/s | 0.80 | Edge deployment |

## Deployment Options for Node.js

### Option 1: Python Bridge (Recommended)

```javascript
const { PythonShell } = require('python-shell');

class PythonEmbedder {
  async embed(text) {
    return new Promise((resolve, reject) => {
      PythonShell.run('embed.py', {
        args: [text]
      }, (err, results) => {
        if (err) reject(err);
        else resolve(JSON.parse(results[0]));
      });
    });
  }
}
```

**embed.py:**
```python
from sentence_transformers import SentenceTransformer
import sys
import json

model = SentenceTransformer('sentence-transformers/all-MiniLM-L12-v2')
text = sys.argv[1]
embedding = model.encode(text).tolist()
print(json.dumps(embedding))
```

### Option 2: ONNX Runtime

```javascript
const ort = require('onnxruntime-node');

class ONNXEmbedder {
  async loadModel() {
    // Load ONNX-converted model
    this.session = await ort.InferenceSession.create('model.onnx');
  }

  async embed(tokens) {
    const feeds = { input_ids: new ort.Tensor('int64', tokens, [1, tokens.length]) };
    const results = await this.session.run(feeds);
    return results.last_hidden_state.data;
  }
}
```

### Option 3: Transformers.js (Browser-Compatible)

```javascript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L12-v2');
const embedding = await embedder('Sample text', { pooling: 'mean', normalize: true });
```

## Embedding Quality Metrics

**Semantic Textual Similarity (STS) Benchmark:**
- Measures correlation between model similarity and human judgment
- Range: 0-1 (higher is better)
- all-MiniLM-L12-v2 achieves 0.83

**Information Retrieval:**
- Retrieval accuracy on QA datasets
- all-MiniLM-L12-v2: ~0.50 MRR@10 on MS MARCO

## Fine-Tuning for Heady™ Domain

If needed, you can fine-tune on domain-specific data:

```python
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

# Load base model
model = SentenceTransformer('sentence-transformers/all-MiniLM-L12-v2')

# Create training examples
train_examples = [
    InputExample(texts=['HeadyBuddy command', 'voice command'], label=0.9),
    InputExample(texts=['system log entry', 'voice command'], label=0.1),
    # ... more examples
]

# Train
train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)
train_loss = losses.CosineSimilarityLoss(model)
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=1,
    warmup_steps=100
)

# Save fine-tuned model
model.save('heady-embedder-v1')
```

## References

- Sentence-Transformers: https://www.sbert.net/
- Hugging Face Hub: https://huggingface.co/sentence-transformers
- Model cards: 
  - https://huggingface.co/sentence-transformers/all-MiniLM-L12-v2
  - https://huggingface.co/sentence-transformers/all-mpnet-base-v2
- Your spec: src/memory/vector-memory.js section
