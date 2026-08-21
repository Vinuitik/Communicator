package com.communicator.knowledgecore.event;

/**
 * Published by FriendKnowledgeService/GroupKnowledgeService/ConnectionKnowledgeService
 * after their save/saveAll/update commits — picked up by knowledge-core's
 * KnowledgeChunkTriggerListener (AFTER_COMMIT), which publishes it onto RabbitMQ's
 * durable knowledge.chunk.trigger queue via KnowledgeChunkTriggerClient (falls back
 * to a direct HTTP POST to ai_agent's POST /knowledge/chunk only if the broker
 * doesn't confirm the publish). Also re-published, unchanged shape, by chrono's
 * nightly reconciliation sweep (ChronoJobService) for Group/Connection knowledge
 * rows that ended up with zero knowledge_chunks. Fields are captured as plain
 * values at publish time (not the JPA entity itself) so nothing downstream has
 * anything to lazy-load once the publishing transaction has already committed.
 *
 * Exactly one of friendId/groupId/(connectionFriend1Id, connectionFriend2Id)
 * is populated per event — same "exactly one subject" invariant as the
 * meeting module's Meeting.validateExactlyOneSubject(), mirrored on the
 * ai_agent/Python side by ChunkingService._validate_subject().
 */
public record KnowledgeChunkTriggerEvent(
        Integer knowledgeId,
        String sourceType, // "FRIEND" | "GROUP" | "CONNECTION"
        Integer friendId,
        Integer groupId,
        Long connectionFriend1Id,
        Long connectionFriend2Id,
        String text
) {
}
