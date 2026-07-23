"""Repository for LLM provider settings: the ollama/cloud mode toggle and
encrypted per-provider API keys.

Read/written here by ai_agent's settings endpoints; host-wrapper
independently reads the same two tables to decide which providers it can
route to (see host-wrapper/llm_router.py). Kept as dedicated SQL rather than
PostgresRepository's generic find/insert adapter — llm_settings is a
singleton row (get/set, not a filtered collection), and provider keys need
explicit encrypt/decrypt at the boundary, not a passthrough.
"""
from typing import List, Optional

from services.encryption_service import EncryptionService

KNOWN_PROVIDERS = ["gemini", "github", "mistral", "groq", "deepseek", "anthropic"]


class LLMSettingsRepository:
    def __init__(self, postgres_repo, encryption_service: Optional[EncryptionService] = None):
        self.postgres_repo = postgres_repo
        self.encryption = encryption_service or EncryptionService()

    async def get_mode(self) -> str:
        async with self.postgres_repo.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT mode FROM llm_settings WHERE id = 1")
        return row["mode"] if row else "ollama"

    async def set_mode(self, mode: str) -> None:
        if mode not in ("ollama", "cloud"):
            raise ValueError(f"Invalid mode: {mode!r} (must be 'ollama' or 'cloud')")
        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                "UPDATE llm_settings SET mode = $1, updated_at = now() WHERE id = 1",
                mode
            )

    async def get_configured_providers(self) -> List[str]:
        """Provider names that have a key set — does NOT decrypt, just existence."""
        async with self.postgres_repo.pool.acquire() as conn:
            rows = await conn.fetch("SELECT provider FROM llm_provider_keys")
        return [r["provider"] for r in rows]

    async def set_provider_key(self, provider: str, api_key: str) -> None:
        if provider not in KNOWN_PROVIDERS:
            raise ValueError(f"Unknown provider: {provider!r} (known: {KNOWN_PROVIDERS})")
        if not api_key or not api_key.strip():
            raise ValueError("api_key cannot be empty")
        if not self.encryption.configured:
            raise RuntimeError("Encryption not configured — set AI_SETTINGS_ENCRYPTION_KEY")

        encrypted = self.encryption.encrypt(api_key.strip())
        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO llm_provider_keys (provider, encrypted_key, updated_at)
                VALUES ($1, $2, now())
                ON CONFLICT (provider) DO UPDATE SET
                    encrypted_key = $2, updated_at = now()
                """,
                provider, encrypted
            )

    async def delete_provider_key(self, provider: str) -> None:
        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute("DELETE FROM llm_provider_keys WHERE provider = $1", provider)
