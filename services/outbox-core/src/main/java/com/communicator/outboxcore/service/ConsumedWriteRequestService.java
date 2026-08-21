package com.communicator.outboxcore.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.communicator.outboxcore.entities.ConsumedWriteRequest;
import com.communicator.outboxcore.repositories.ConsumedWriteRequestRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Idempotency-key ledger used by every offline-outbox write kind, across every
 * module (see ConsumedWriteRequest). One dedup mechanism shared by every replay
 * path: a client retrying a direct call, or a Drive mailbox consume job replaying
 * a batch file.
 */
@Service
@RequiredArgsConstructor
public class ConsumedWriteRequestService {

    private final ConsumedWriteRequestRepository repository;

    public boolean isDuplicate(UUID requestId) {
        return requestId != null && repository.existsById(requestId);
    }

    @Transactional
    public void markConsumed(UUID requestId, String kind) {
        if (requestId == null) return;
        repository.save(new ConsumedWriteRequest(requestId, kind, LocalDateTime.now()));
    }
}
