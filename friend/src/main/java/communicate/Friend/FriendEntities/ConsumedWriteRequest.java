package communicate.Friend.FriendEntities;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Idempotency ledger for the offline-write outbox (react/src/pwa/outbox.ts).
 * One row per client-generated Idempotency-Key that has already been applied
 * — checked before re-applying a write, whether the replay comes from a
 * direct-call retry or a Drive mailbox file consumed twice. Generic across
 * write kinds so future outbox write kinds don't need their own ledger.
 */
@Entity
@Table(name = "consumed_write_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsumedWriteRequest {

    @Id
    private UUID requestId;

    private String kind;

    private LocalDateTime consumedAt;
}
