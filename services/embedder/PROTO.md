# Embedder — Proto (standalone ONNX EmbeddingGemma service)

> **Proto, not a flow.** This service has no user-facing pipeline of its own — it's a dependency of [ai_agent](../ai_agent/PROTO.md)'s knowledge-summarization and search pipelines. See [flows/knowledge-rag.md](../flows/knowledge-rag.md) for how it's actually used end-to-end.

Files: main.py, model_runtime.py, Dockerfile, .env.example

## Role

Text embeddings, nothing else. FastAPI service, port **8010** (container `embedder`), internal only — not routed through nginx, not host-exposed in normal operation (it *is* mapped to host port 8010 in `docker-compose.yml` for standalone curl-testing; that mapping has no other purpose and could be dropped once ai_agent's the only real caller). Ported from ObsidianOptimizer's `embedder/model_runtime.py` (2026-07-23), right-sized: OO's version also served flashcard generation, FSRS scheduling, multi-modal ingest (whisper/CLIP/PDF/web), and MCP tools, with GPU-slot arbitration between the embedder and those ingest models. None of that exists here — only the embedding surface was ported, CPU-only.

## Internal wiring

`POST /embed {texts: [str], kind: "document"|"query"}` → `model_runtime.embed_texts(texts, kind)`:

```
1. prefix = EMBED_DOC_PREFIX ("title: none | text: ") if kind=document
            EMBED_QUERY_PREFIX ("task: search result | query: ") if kind=query
2. texts = [prefix + t for t in texts]
3. batch in groups of EMBED_BATCH_SIZE (default 16) → tokenizer → onnxruntime session.run()
4. output is either:
     "sentence_embedding" (pooling+dense projections already in the ONNX graph — use directly)
     else: mean-pool last_hidden_state over non-padding tokens (attention_mask-weighted)
5. L2-normalize
→ {embeddings: [[float; 768]], model, dim}
```

`GET /health` → `{status, model, dim}` (dim=0/model="not loaded" before `model_runtime.init()` completes in the FastAPI lifespan).

Model loads once at startup (`model_runtime.init()`): tries `/models` volume with `local_files_only=True` first (zero network round-trips on warm start), falls back to a one-time Hugging Face Hub download on cache miss. `onnx-community/embeddinggemma-300m-ONNX`, int8 quantized (`onnx/model_quantized.onnx`, ~310MB, QAT — near-lossless for this model), `CPUExecutionProvider`.

## Seams

**Inbound:**

| Caller | Trigger | Endpoint |
|---|---|---|
| ai_agent `EmbeddingService` | every chunk-indexing and query-search call | `POST /embed` |

**Outbound:**

| Callee | Why | How / where |
|---|---|---|
| **Hugging Face Hub** (cloud, first run only) | download model + tokenizer if `/models` volume is empty | `huggingface_hub.hf_hub_download`, `HF_TOKEN` env var optional (raises rate limits, not required) |

No database, no cache, no other service dependency — fully stateless besides the loaded model in memory.

## Gotchas / Technology Notes

- **Prompt-asymmetric — the one real gotcha.** EmbeddingGemma embeds the *same text* differently depending on `kind`: document prefix `"title: none | text: "`, query prefix `"task: search result | query: "`. Same model weights, different resulting vector — mixing them up (e.g. embedding a search query with `kind=document`) silently degrades retrieval quality with **no error**. Verified live (2026-07-23): identical input text under the two kinds produces genuinely different embeddings. Every caller must know which side it's on — `ai_agent/services/embedding_service.py`'s `embed_texts()` (documents) vs `embed_query()` (queries) encode this at the call-site level so it can't be gotten wrong by accident.
- **CPU-only, no GPU-contention arbitration.** OO's version had `gpu_slot.py` to arbitrate GPU access between the embedder and other ingest models (whisper, CLIP) sharing one card. This service doesn't have that — no other GPU-bound model exists in Communicator today. If one gets added later, don't just re-add OO's eviction machinery reflexively; check whether contention is actually real first.
- **`/models` is a named Docker volume** (`embedder-models`), not baked into the image — first container start downloads ~310MB from HF Hub, every start after that is offline. If you `docker volume rm` it, expect one slow cold start.
- **External-data ONNX exports** (embeddinggemma and similar) keep weights in a sibling `<file>.onnx_data` alongside the `.onnx` graph file — `model_runtime.init()` best-effort downloads that companion file too; single-file exports (no `_data` sibling) just skip it silently, that's expected for some other models, not a bug.
- **`EMBED_ORT_OPT` defaults to `basic`, not `all`.** onnxruntime's EXTENDED-tier graph optimization (`SimplifiedLayerNormFusion`) has broken fp16 ONNX exports in OO's history — BASIC keeps only the cheap, safe optimizations. Don't bump this to `all`/`extended` without verifying the specific model still loads and produces correct output.

## Change Index

| Thing to change | Where |
|---|---|
| Model / quantization | `EMBED_MODEL` / `EMBED_ONNX_FILE` env vars → `model_runtime.py` |
| Doc/query prompt prefixes | `EMBED_DOC_PREFIX` / `EMBED_QUERY_PREFIX` env vars (auto-set for embeddinggemma, override for a model swap) |
| Batch size | `EMBED_BATCH_SIZE` env var |
| ONNX graph optimization level | `EMBED_ORT_OPT` env var (`basic`/`extended`/`all`/`disabled`) — see gotcha above before raising it |
| Model cache location | `MODEL_CACHE` env var → compose volume `embedder-models:/models` |
| API surface | `main.py` (`POST /embed`, `GET /health`) |
| Port / compose wiring | `docker-compose.yml` service `embedder` (port 8010) |
