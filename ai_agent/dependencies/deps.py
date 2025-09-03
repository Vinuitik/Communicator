from fastapi import Depends
from services.agent_service import AgentService
from services.knowledge_service import KnowledgeService

# Global service instances
_agent_service = None
_knowledge_service = None

async def get_agent_service() -> AgentService:
    """
    Dependency to get the agent service instance
    
    Returns:
        AgentService instance
    """
    global _agent_service
    if _agent_service is None:
        _agent_service = AgentService()
        await _agent_service.initialize()
    return _agent_service

async def get_knowledge_service(
    agent_service: AgentService = Depends(get_agent_service)
) -> KnowledgeService:
    """
    Dependency to get the knowledge service instance
    
    Args:
        agent_service: Injected agent service
        
    Returns:
        KnowledgeService instance
    """
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService(agent_service)
    return _knowledge_service
