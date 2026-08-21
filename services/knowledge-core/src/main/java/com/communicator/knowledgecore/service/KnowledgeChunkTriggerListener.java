package com.communicator.knowledgecore.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Deliberately AFTER_COMMIT, not a plain @EventListener — same reasoning as
 * meeting's MeetingService.onFriendRescheduled: a failure dispatching the
 * chunk-trigger must never roll back the friend/group/connection knowledge
 * save that published this event, and firing before commit risks triggering
 * for data that the transaction ends up rolling back anyway.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeChunkTriggerListener {

    private final KnowledgeChunkTriggerClient client;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onKnowledgeChunkTrigger(KnowledgeChunkTriggerEvent event) {
        try {
            client.triggerChunk(event);
        } catch (Exception e) {
            log.warn("Unexpected error dispatching chunk-trigger for knowledge {}: {}",
                    event.knowledgeId(), e.getMessage());
        }
    }
}
