package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Nightly Bin purge: friends soft-deleted (Friend#deletedAt) more than 7
 * days ago are hard-deleted for real. Safe to do a plain
 * {@code friendRepository.delete()} here — the meeting/meeting_attendee/
 * friend_knowledge_review FK gap that used to 500 on delete is now closed
 * with DB-level ON DELETE CASCADE (see @OnDelete on those entities'
 * friend/meeting fields); everything else already cascades via Friend's own
 * @OneToMany(orphanRemoval = true) fields.
 */
@Service
@RequiredArgsConstructor
public class BinPurgeService {

    private static final Logger log = LoggerFactory.getLogger(BinPurgeService.class);
    private static final int RETENTION_DAYS = 7;

    private final FriendRepository friendRepository;

    @Scheduled(cron = "${friend.bin.purge.cron:0 0 3 * * *}", zone = "UTC")
    @Transactional
    public void purgeExpiredBinEntries() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        List<Friend> expired = friendRepository.findByDeletedAtBefore(cutoff);
        if (expired.isEmpty()) {
            return;
        }
        log.info("[BinPurge] purging {} friend(s) deleted before {}", expired.size(), cutoff);
        friendRepository.deleteAll(expired);
    }
}
