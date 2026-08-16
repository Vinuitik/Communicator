package communicate.Friend.FriendService;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.ConsumedWriteRequest;
import communicate.Friend.FriendRepositories.ConsumedWriteRequestRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Idempotency-key ledger used by every offline-outbox write kind (see
 * ConsumedWriteRequest). One dedup mechanism shared by both replay paths: a
 * client retrying a direct call, and the future Drive mailbox consume job
 * replaying a batch file.
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
