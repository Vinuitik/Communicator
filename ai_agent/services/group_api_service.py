"""Group API Service - minimal HTTP client for Group Java service.

Mirrors FriendApiService's pattern (see that file's docstring) but only
covers what cross-entity search needs today: a group's display name for
result enrichment. Extend this the same way FriendApiService grew if more
group data is ever needed here.
"""
from typing import Optional
import logging
import aiohttp

from config.settings import settings

logger = logging.getLogger(__name__)


class GroupApiService:
    """Handles REST API communication with the Group module (same JVM
    monolith as Friend, reached directly on communicator-app:8080, not via
    nginx — same convention FriendApiService uses).

    Endpoints Used:
    - GET /{groupId} → {"success": bool, "group": {..., "name": str}}
    """

    def __init__(self):
        self.base_url = settings.group_service_url
        self.timeout = settings.group_service_timeout

        logger.info(f"Initialized GroupApiService - base_url={self.base_url}, timeout={self.timeout}s")

    async def fetch_group_name(self, group_id: int) -> Optional[str]:
        """Fetch a group's display name for cross-entity search result enrichment.

        Calls: GET /{groupId}  (GroupApiController.getGroupDetails)

        Args:
            group_id: ID of the group

        Returns:
            Group's name, or None if not found/on error (best-effort — a
            missing name shouldn't fail the whole search response).
        """
        url = f"{self.base_url}/{group_id}"

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        body = await response.json()
                        group = body.get("group") or {}
                        return group.get("name")
                    logger.warning(f"Failed to fetch group name for {group_id}: HTTP {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error fetching group name for {group_id}: {e}")
            return None
