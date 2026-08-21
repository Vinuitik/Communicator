"""Owns the ONNX text-embedding model + tokenizer.

Ported from ObsidianOptimizer's embedder/model_runtime.py, right-sized:
Communicator has no GPU-contention story (no whisper/CLIP ingest models
sharing a card), so the gpu_slot arbitration, capped CUDA arena, and
sub-batching-for-VRAM logic were dropped — this is CPU-only. If a GPU
speeds things up later, add a plain CUDAExecutionProvider session; don't
re-add the eviction machinery unless something else actually contends
for the GPU.
"""
import logging
import os
from typing import List

import numpy as np
import onnxruntime as ort

log = logging.getLogger("embedder")

# EmbeddingGemma-300m (768-dim out, asymmetric prompts, QAT int8). Same model
# OO settled on: top multilingual model <500M on MTEB, and unlike symmetric
# models gives a real cosine band (not everything floored ~0.87-0.91).
EMBED_MODEL = os.environ.get("EMBED_MODEL", "onnx-community/embeddinggemma-300m-ONNX")
MODEL_CACHE = os.environ.get("MODEL_CACHE", "/models")
# int8 (QAT — near-lossless for this model) by default: ~310MB, CPU-friendly.
EMBED_ONNX_FILE = os.environ.get("EMBED_ONNX_FILE", "onnx/model_quantized.onnx")

# EmbeddingGemma is prompt-asymmetric: queries and documents get different task
# prefixes (same weights — the prompt conditions the space so questions land near
# texts that ANSWER them, not texts phrased like them). Mixing them up silently
# degrades retrieval with no error. Env-overridable for model swaps.
_IS_GEMMA = "embeddinggemma" in EMBED_MODEL.lower()
EMBED_QUERY_PREFIX = os.environ.get(
    "EMBED_QUERY_PREFIX", "task: search result | query: " if _IS_GEMMA else "")
EMBED_DOC_PREFIX = os.environ.get(
    "EMBED_DOC_PREFIX", "title: none | text: " if _IS_GEMMA else "")

# Sub-batch size for a single session.run — bounds peak memory for a big request.
EMBED_BATCH_SIZE = int(os.environ.get("EMBED_BATCH_SIZE", "16"))

# Shared state — populated by init(), read by the endpoint.
# Keys: tokenizer, dim, model_name, onnx_path, session.
state: dict = {}

# onnxruntime's EXTENDED-tier graph optimisation (SimplifiedLayerNormFusion) has
# tripped up some fp16 ONNX exports in OO's history. BASIC keeps the cheap, safe
# optimisations and skips the aggressive fusions. Override with EMBED_ORT_OPT=
# all|extended|basic|disabled to chase speed once a model is verified to load clean.
_ORT_OPT = {
    "all": ort.GraphOptimizationLevel.ORT_ENABLE_ALL,
    "extended": ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED,
    "basic": ort.GraphOptimizationLevel.ORT_ENABLE_BASIC,
    "disabled": ort.GraphOptimizationLevel.ORT_DISABLE_ALL,
}


def _session_options() -> ort.SessionOptions:
    so = ort.SessionOptions()
    so.graph_optimization_level = _ORT_OPT.get(
        os.environ.get("EMBED_ORT_OPT", "basic").lower(),
        ort.GraphOptimizationLevel.ORT_ENABLE_BASIC)
    return so


def init() -> None:
    """Load tokenizer + ONNX session into shared state. Called once from lifespan.

    Pure onnxruntime — no torch, no optimum. The model ships pre-exported ONNX on
    the Hub, so there's no PyTorch→ONNX conversion step.
    """
    from huggingface_hub import hf_hub_download
    from transformers import AutoConfig, AutoTokenizer

    log.info("Loading model '%s' (cache: %s, onnx: %s) …",
             EMBED_MODEL, MODEL_CACHE, EMBED_ONNX_FILE)

    def _resolve(local_only: bool):
        # local_only=True reads the /models volume with ZERO network — no HF Hub
        # round-trips, no rate-limit, no stall.
        tokenizer = AutoTokenizer.from_pretrained(
            EMBED_MODEL, cache_dir=MODEL_CACHE, local_files_only=local_only)
        onnx_path = hf_hub_download(
            EMBED_MODEL, EMBED_ONNX_FILE, cache_dir=MODEL_CACHE, local_files_only=local_only)
        # External-data exports (embeddinggemma et al.) keep weights in a sibling
        # '<file>.onnx_data' — the session load fails without it. Best-effort: not
        # every repo splits its weights out.
        try:
            hf_hub_download(EMBED_MODEL, EMBED_ONNX_FILE + "_data",
                            cache_dir=MODEL_CACHE, local_files_only=local_only)
        except Exception:  # noqa: BLE001 — single-file exports have no _data companion
            pass
        dim = AutoConfig.from_pretrained(
            EMBED_MODEL, cache_dir=MODEL_CACHE, local_files_only=local_only).hidden_size
        return tokenizer, onnx_path, dim

    try:
        tokenizer, onnx_path, dim = _resolve(local_only=True)
        log.info("Loaded tokenizer/config from local cache — no HF Hub requests.")
    except Exception as e:
        # Cache miss (first run) — download once.
        log.info("Model not fully cached (%s) — downloading from HF Hub (one-time) …",
                 type(e).__name__)
        tokenizer, onnx_path, dim = _resolve(local_only=False)

    session = ort.InferenceSession(
        onnx_path, sess_options=_session_options(), providers=["CPUExecutionProvider"])

    state.update(tokenizer=tokenizer, dim=dim, model_name=EMBED_MODEL,
                 onnx_path=onnx_path, session=session)
    log.info("Model ready — dim=%d, provider=CPU, batch=%d", dim, EMBED_BATCH_SIZE)


def embed_texts(texts: List[str], kind: str = "document") -> List[List[float]]:
    """L2-normalised embeddings, preserving input order.

    kind='document' embeds content to be retrieved; kind='query' embeds a search
    query. Prompt-asymmetric models (EmbeddingGemma) map the two differently —
    mixing them up silently degrades retrieval, so every caller must say which
    side it is. Raises KeyError if init() hasn't run.
    """
    if not texts:
        return []
    prefix = EMBED_QUERY_PREFIX if kind == "query" else EMBED_DOC_PREFIX
    texts = [prefix + t for t in texts] if prefix else list(texts)
    session = state["session"]
    out: List[List[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i:i + EMBED_BATCH_SIZE]
        out.extend(_embed_batch(session, batch))
    return out


def _embed_batch(session, texts: List[str]) -> List[List[float]]:
    """Embed one sub-batch on the given onnxruntime session."""
    tokenizer = state["tokenizer"]
    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="np",
    )

    # Feed only the inputs this graph declares (BERT-based models also take
    # token_type_ids; some exports omit it), cast to the int64 ONNX expects.
    input_names = {i.name for i in session.get_inputs()}
    feeds = {k: np.asarray(v, dtype=np.int64)
             for k, v in encoded.items() if k in input_names}

    outputs = session.run(None, feeds)
    out_names = [o.name for o in session.get_outputs()]
    if "sentence_embedding" in out_names:
        # Sentence-transformers-style export: pooling + dense projections + norm
        # are IN the graph. Pooling last_hidden_state ourselves would skip the
        # dense layers (embeddinggemma: 768→3072→768) and produce garbage.
        embeddings = outputs[out_names.index("sentence_embedding")].astype(np.float32)
    else:
        if "last_hidden_state" in out_names:
            token_embeddings = outputs[out_names.index("last_hidden_state")]
        else:                                             # first 3-D output
            token_embeddings = next(a for a in outputs if a.ndim == 3)
        token_embeddings = token_embeddings.astype(np.float32)  # (batch, seq, dim)
        attention_mask = encoded["attention_mask"]        # (batch, seq)

        # Mean pooling over non-padding tokens
        mask_expanded = attention_mask[:, :, np.newaxis].astype(np.float32)
        summed = np.sum(token_embeddings * mask_expanded, axis=1)
        counts = np.clip(mask_expanded.sum(axis=1), a_min=1e-9, a_max=None)
        embeddings = summed / counts                      # (batch, dim)

    # L2 normalise
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / np.clip(norms, a_min=1e-9, a_max=None)

    return embeddings.tolist()
