"""Load + decrypt LLM provider API keys from Postgres (llm_provider_keys),
the table ai_agent's settings UI writes to (see ai_agent/routers/settings.py).

Failure anywhere here (Postgres unreachable, decryption not configured, a row
that won't decrypt) is logged and swallowed, never raised — an empty dict just
means every provider falls back to its host-wrapper/.env value, which is the
same behavior this service had before the settings UI existed. A DB hiccup at
startup shouldn't take the whole gateway down.
"""
import logging
import os

import psycopg2

log = logging.getLogger("host-wrapper")

POSTGRES_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://myapp_user:example@postgresDB:5432/my_database")


def load_db_keys(encryption) -> dict:
    """Returns {provider_name: decrypted_key} for every row that decrypts cleanly."""
    if not encryption.configured:
        log.info("AI_SETTINGS_ENCRYPTION_KEY not set — provider keys come from .env only")
        return {}

    try:
        conn = psycopg2.connect(POSTGRES_DSN, connect_timeout=5)
    except Exception as e:
        log.warning(f"Could not connect to Postgres for provider keys, falling back to .env: {e}")
        return {}

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT provider, encrypted_key FROM llm_provider_keys")
            rows = cur.fetchall()
    except Exception as e:
        log.warning(f"Could not read llm_provider_keys, falling back to .env: {e}")
        return {}
    finally:
        conn.close()

    keys = {}
    for provider, encrypted in rows:
        try:
            keys[provider] = encryption.decrypt(bytes(encrypted))
        except Exception as e:
            log.warning(f"Could not decrypt key for provider '{provider}', skipping: {e}")

    log.info(f"Loaded {len(keys)} provider key(s) from Postgres: {sorted(keys.keys())}")
    return keys
