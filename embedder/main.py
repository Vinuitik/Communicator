"""Embedder — standalone ONNX EmbeddingGemma service (ported from ObsidianOptimizer,
2026-07-23).

Right-sized for Communicator: OO's version also served flashcard generation,
FSRS scheduling, ingest (whisper/CLIP/PDF/web), and MCP tools, and arbitrated
GPU access between the embedder and those ingest models. Communicator has
none of that today, so only the embedding surface was ported: GET /health,
POST /embed. CPU-only (see model_runtime.py) — no gpu_slot.

NOT wired into ai_agent yet — ai_agent still calls Ollama for embeddings.
This service exists standalone pending the search/embedding-service rewiring
stage (separate follow-up work).
"""
import logging
from contextlib import asynccontextmanager
from typing import List, Literal

from fastapi import FastAPI
from pydantic import BaseModel

import model_runtime
from model_runtime import state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("embedder")


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_runtime.init()
    yield
    state.clear()


app = FastAPI(title="Embedder", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: List[str]
    # 'document' = content being indexed; 'query' = a search query. Asymmetric
    # models (EmbeddingGemma) prefix the two differently — see model_runtime.
    kind: Literal["document", "query"] = "document"


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    dim: int


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": state.get("model_name", "not loaded"),
        "dim": state.get("dim", 0),
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    embeddings = model_runtime.embed_texts(req.texts, kind=req.kind)
    return EmbedResponse(embeddings=embeddings, model=state["model_name"], dim=state["dim"])
