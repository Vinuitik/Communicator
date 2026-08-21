from fastapi import APIRouter, Depends, HTTPException
from models.schemas import SearchAllInput
from services.search_service import SearchService
from services.friend_api_service import FriendApiService
from services.group_api_service import GroupApiService
from dependencies.deps import get_search_service, get_friend_api_service, get_group_api_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])


@router.post("/search")
async def search_all(
    input_data: SearchAllInput,
    search_service: SearchService = Depends(get_search_service),
    friend_api_service: FriendApiService = Depends(get_friend_api_service),
    group_api_service: GroupApiService = Depends(get_group_api_service),
):
    """
    Cross-entity hybrid search: find a Friend/Group/Connection by the
    facts/notes recorded about them, not just by name. Same pgvector +
    BM25 + RRF mechanics as the per-friend summarization search
    (SearchService.search), just not scoped to one friend's knowledge_ids
    (SearchService.search_all).

    Friend/group display names are fetched best-effort after the search —
    a name lookup failure degrades that one result's friend_name/group_name
    to null rather than failing the whole response.
    """
    logger.info(f"Received cross-entity search request: query='{input_data.query}', top_k={input_data.top_k}")

    try:
        raw_results = await search_service.search_all(input_data.query, input_data.top_k)
    except Exception as e:
        logger.error(f"Error in cross-entity search for query '{input_data.query}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error searching: {str(e)}")

    results = []
    for r in raw_results:
        entry = {
            "source_type": r["source_type"],
            "friend_id": r["friend_id"],
            "friend_name": None,
            "group_id": r["group_id"],
            "group_name": None,
            "connection_friend1_id": r["connection_friend1_id"],
            "connection_friend2_id": r["connection_friend2_id"],
            "matched_text": r["chunk_text"],
            "score": r["score"],
        }

        if r["source_type"] == "FRIEND" and r["friend_id"] is not None:
            entry["friend_name"] = await friend_api_service.fetch_friend_name(r["friend_id"])
        elif r["source_type"] == "GROUP" and r["group_id"] is not None:
            entry["group_name"] = await group_api_service.fetch_group_name(r["group_id"])
        elif r["source_type"] == "CONNECTION" and r["connection_friend1_id"] is not None:
            # Both sides of the connection are friends — surface both names,
            # reusing the same friend-name lookup used for FRIEND results.
            entry["friend1_name"] = await friend_api_service.fetch_friend_name(r["connection_friend1_id"])
            entry["friend2_name"] = await friend_api_service.fetch_friend_name(r["connection_friend2_id"])

        results.append(entry)

    return {"query": input_data.query, "results": results, "count": len(results)}
