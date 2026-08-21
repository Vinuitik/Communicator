package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.Friend;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LeechServiceTest {

    private final LeechService service = new LeechService();

    @Test
    void recordMiss_incrementsCounter_belowThreshold_notYetLeech() {
        Friend friend = Friend.builder().missedDueCount(0).leech(false).build();

        service.recordMiss(friend);
        service.recordMiss(friend);

        assertThat(friend.getMissedDueCount()).isEqualTo(2);
        assertThat(friend.getLeech()).isFalse();
    }

    @Test
    void recordMiss_atThreshold_flagsLeech() {
        Friend friend = Friend.builder().missedDueCount(0).leech(false).build();

        for (int i = 0; i < LeechService.LEECH_THRESHOLD; i++) {
            service.recordMiss(friend);
        }

        assertThat(friend.getMissedDueCount()).isEqualTo(LeechService.LEECH_THRESHOLD);
        assertThat(friend.getLeech()).isTrue();
    }

    @Test
    void recordHit_resetsCounterAndClearsFlag() {
        Friend friend = Friend.builder().missedDueCount(5).leech(true).build();

        service.recordHit(friend);

        assertThat(friend.getMissedDueCount()).isEqualTo(0);
        assertThat(friend.getLeech()).isFalse();
    }

    @Test
    void recordMiss_handlesNullStartingCount() {
        Friend friend = Friend.builder().missedDueCount(null).leech(null).build();

        service.recordMiss(friend);

        assertThat(friend.getMissedDueCount()).isEqualTo(1);
        assertThat(friend.getLeech()).isFalse();
    }
}
