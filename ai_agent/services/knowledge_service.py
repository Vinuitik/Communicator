from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .agent_service import AgentService
from utils.json_parser import fix_json_format
from prompts.prompt_manager import load_prompt_parts

class KnowledgeService:
    """Service for handling knowledge-related operations"""
    
    def __init__(self, agent_service: AgentService):
        self.agent_service = agent_service
    
    async def summarize_friend_knowledge(self, friend_id: int) -> Dict[str, Any]:
        """
        Create a knowledge summary for a friend using a LangChain chain
        
        Args:
            friend_id: ID of the friend to summarize knowledge for
            
        Returns:
            Structured JSON summary of friend's knowledge
        """
        try:
            # Step 1: Get friend knowledge using MCP tool
            get_knowledge_tool = self.agent_service.get_tool_by_name("get_friend_knowledge")
            if not get_knowledge_tool:
                raise ValueError("get_friend_knowledge tool not found")
            
            # Call the MCP tool to get knowledge
            knowledge_result = await get_knowledge_tool.ainvoke({
                "friend_id": friend_id,
                "page": 0,
                "size": 30  # Get up to 30 knowledge items
            })
            
            # Step 2: Create summarization chain
            summarization_prompt = self._create_summarization_prompt()
            chain = (
                summarization_prompt 
                | self.agent_service.llm 
                | StrOutputParser() 
                | fix_json_format
            )
            
            # Step 3: Process and return result
            result = await chain.ainvoke({"knowledge_data": knowledge_result})
            return result
            
        except Exception as e:
            raise RuntimeError(f"Error in knowledge summarization: {str(e)}")
    
    def _create_summarization_prompt(self) -> ChatPromptTemplate:
        """
        Create the prompt template for knowledge summarization
        
        Returns:
            ChatPromptTemplate for summarizing friend knowledge
        """
        messages = load_prompt_parts("knowledge_summary")
        if not messages:
            # Fallback to inline prompt if files are missing
            return ChatPromptTemplate.from_messages([
                ("system", "You are an expert at analyzing personal knowledge and creating structured summaries.\n\nReturn ONLY a JSON object."),
                ("user", "Analyze this friend knowledge data and create a structured summary:\n\n{knowledge_data}")
            ])
        return ChatPromptTemplate.from_messages(messages)
    
    def get_available_knowledge_tools(self) -> list:
        """
        Get list of available knowledge-related tools
        
        Returns:
            List of knowledge tool names
        """
        all_tools = self.agent_service.list_available_tools()
        knowledge_tools = [tool for tool in all_tools if 'knowledge' in tool.lower()]
        return knowledge_tools
