package com.communicator.outboxcore.entities;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Idempotency ledger for every offline-outbox write kind, across every module
 * (react/src/pwa/outbox.ts). One row per client-generated Idempotency-Key that
 * has already been applied — checked before re-applying a write, whether the
 * replay comes from a direct-call retry or a Drive mailbox file consumed twice.
 *
 * Implements Persistable so save() always does an INSERT, never a merge/upsert
 * (the default for an entity with a manually-assigned @Id and no @Version).
 * That makes a genuinely concurrent duplicate insert throw a real constraint
 * violation instead of silently overwriting — see ConsumedWriteRequestService.
 */
@Entity
@Table(name = "consumed_write_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsumedWriteRequest implements Persistable<UUID> {

    @Id
    private UUID requestId;

    private String kind;

    private LocalDateTime consumedAt;

    @Override
    public UUID getId() {
        return requestId;
    }

    @Override
    public boolean isNew() {
        return true;
    }
}
