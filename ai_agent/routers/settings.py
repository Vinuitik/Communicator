"""LLM provider settings — the ollama/cloud mode toggle and encrypted cloud
provider API keys. Backs the settings page in the legacy MPA.

Never returns decrypted key material — GET only reports which providers
have a key configured (bool), matching how the UI should render it (a
password-style input showing "configured" vs. a masked placeholder, not the
actual key).
"""
import logging

from aiohttp import ClientSession, ClientTimeout, ClientError
from fastapi import APIRouter, Depends, HTTPException

from config.settings import settings
from models.schemas import LLMModeUpdate, LLMProviderKeyUpdate
from repositories.llm_settings_repository import LLMSettingsRepository, KNOWN_PROVIDERS
from dependencies.deps import get_llm_settings_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings/llm", tags=["settings"])


async def _trigger_host_wrapper_reload():
    """Best-effort: ask host-wrapper to re-read provider keys from Postgres
    right away instead of waiting for its own refresh cycle. Failure here
    (host-wrapper down/unreachable) is logged, not raised — the save itself
    already succeeded, host-wrapper will pick up the change on its own next
    reload regardless."""
    url = f"{settings.host_wrapper_url}/admin/reload"
    try:
        async with ClientSession() as session:
            async with session.post(url, timeout=ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    logger.warning(f"host-wrapper reload returned {resp.status}")
    except ClientError as e:
        logger.warning(f"Could not reach host-wrapper to trigger reload: {e}")


@router.get("")
async def get_llm_settings(
    repo: LLMSettingsRepository = Depends(get_llm_settings_repository)
):
    """Current mode + which cloud providers have a key configured."""
    mode = await repo.get_mode()
    configured = set(await repo.get_configured_providers())
    return {
        "mode": mode,
        "providers": {name: (name in configured) for name in KNOWN_PROVIDERS},
    }


@router.put("/mode")
async def set_llm_mode(
    body: LLMModeUpdate,
    repo: LLMSettingsRepository = Depends(get_llm_settings_repository)
):
    await repo.set_mode(body.mode)
    logger.info(f"LLM mode set to '{body.mode}'")
    return {"mode": body.mode}


@router.put("/providers/{provider}")
async def set_provider_key(
    provider: str,
    body: LLMProviderKeyUpdate,
    repo: LLMSettingsRepository = Depends(get_llm_settings_repository)
):
    if provider not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")
    try:
        await repo.set_provider_key(provider, body.api_key)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    await _trigger_host_wrapper_reload()
    return {"provider": provider, "configured": True}


@router.delete("/providers/{provider}")
async def delete_provider_key(
    provider: str,
    repo: LLMSettingsRepository = Depends(get_llm_settings_repository)
):
    if provider not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")
    await repo.delete_provider_key(provider)
    await _trigger_host_wrapper_reload()
    return {"provider": provider, "configured": False}


@router.get("/host-wrapper-status")
async def host_wrapper_status():
    """Reachability + provider readiness, for the settings page's status
    indicator — cloud mode is only actually usable if this is reachable."""
    url = f"{settings.host_wrapper_url}/providers"
    try:
        async with ClientSession() as session:
            async with session.get(url, timeout=ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    return {"reachable": True, "providers": await resp.json()}
                return {"reachable": False, "error": f"HTTP {resp.status}"}
    except ClientError as e:
        return {"reachable": False, "error": str(e)}
