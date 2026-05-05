package communicate.integration.repositories;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AnalyticsRepositoryIT extends AbstractIntegrationTest {

    @Autowired AnalyticsRepository analyticsRepository;
    @Autowired FriendRepository friendRepository;

    private static final LocalDate TARGET = LocalDate.of(2024, 6, 10);

    // ── TC-I01: only friends with data on target date are returned ────────────

    @Test
    void findFriendIdsWithInteractionsOnDate_returnsOnlyMatchingFriends() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        Friend bob   = friendRepository.save(buildFriend("Bob"));
        Friend carol = friendRepository.save(buildFriend("Carol"));

        analyticsRepository.save(buildAnalytics(alice, TARGET,     "***", 1.0));
        analyticsRepository.save(buildAnalytics(bob,   TARGET,     "**",  0.5));
        // Carol has no entry on TARGET

        List<Integer> result = analyticsRepository.findFriendIdsWithInteractionsOnDate(
                List.of(alice.getId(), bob.getId(), carol.getId()), TARGET);

        assertThat(result).containsExactlyInAnyOrder(alice.getId(), bob.getId());
        assertThat(result).doesNotContain(carol.getId());
    }

    // ── TC-I02: multiple entries same friend same day → ID appears once ───────

    @Test
    void findFriendIdsWithInteractionsOnDate_multipleSameDayEntries_idAppearsOnce() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        analyticsRepository.save(buildAnalytics(alice, TARGET, "***", 1.0));
        analyticsRepository.save(buildAnalytics(alice, TARGET, "***", 2.0));
        analyticsRepository.save(buildAnalytics(alice, TARGET, "**",  0.5));

        List<Integer> result = analyticsRepository.findFriendIdsWithInteractionsOnDate(
                List.of(alice.getId()), TARGET);

        assertThat(result).hasSize(1);
        assertThat(result).containsExactly(alice.getId());
    }

    // ── TC-I03: friends with no analytics at all return empty ─────────────────

    @Test
    void findFriendIdsWithInteractionsOnDate_friendsWithNoAnalytics_returnsEmpty() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        Friend bob   = friendRepository.save(buildFriend("Bob"));

        List<Integer> result = analyticsRepository.findFriendIdsWithInteractionsOnDate(
                List.of(alice.getId(), bob.getId()), TARGET);

        assertThat(result).isEmpty();
    }

    // ── TC-I04: empty friendIds list → empty result, no exception ────────────

    @Test
    void findFriendIdsWithInteractionsOnDate_emptyFriendIdsList_returnsEmpty() {
        List<Integer> result = analyticsRepository
                .findFriendIdsWithInteractionsOnDate(List.of(), TARGET);
        assertThat(result).isEmpty();
    }

    // ── TC-I05: IDs not in the DB → not returned even if analytics exist ─────

    @Test
    void findFriendIdsWithInteractionsOnDate_nonExistentIds_notReturned() {
        List<Integer> result = analyticsRepository
                .findFriendIdsWithInteractionsOnDate(List.of(99999, 88888), TARGET);
        assertThat(result).isEmpty();
    }

    // ── TC-I06: analytics one day BEFORE target → not returned ───────────────

    @Test
    void findFriendIdsWithInteractionsOnDate_dayBefore_notReturned() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        analyticsRepository.save(buildAnalytics(alice, TARGET.minusDays(1), "***", 1.0));

        List<Integer> result = analyticsRepository
                .findFriendIdsWithInteractionsOnDate(List.of(alice.getId()), TARGET);

        assertThat(result).isEmpty();
    }

    // ── TC-I07: analytics one day AFTER target → not returned ────────────────

    @Test
    void findFriendIdsWithInteractionsOnDate_dayAfter_notReturned() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        analyticsRepository.save(buildAnalytics(alice, TARGET.plusDays(1), "***", 1.0));

        List<Integer> result = analyticsRepository
                .findFriendIdsWithInteractionsOnDate(List.of(alice.getId()), TARGET);

        assertThat(result).isEmpty();
    }

    // ── TC-I08: findByFriendIdAndDateBetween — correct range ─────────────────

    @Test
    void findByFriendIdAndDateBetween_returnsOnlyEntriesInRange() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        analyticsRepository.save(buildAnalytics(alice, TARGET.minusDays(2), "**", 1.0)); // before
        analyticsRepository.save(buildAnalytics(alice, TARGET,               "**", 1.0)); // in
        analyticsRepository.save(buildAnalytics(alice, TARGET.plusDays(1),   "**", 1.0)); // in
        analyticsRepository.save(buildAnalytics(alice, TARGET.plusDays(5),   "**", 1.0)); // after

        List<Analytics> result = analyticsRepository.findByFriendIdAndDateBetween(
                alice.getId(), TARGET, TARGET.plusDays(1));

        assertThat(result).hasSize(2);
    }

    // ── TC-I09: single day range (left = right) ───────────────────────────────

    @Test
    void findByFriendIdAndDateBetween_singleDayRange_returnsOnlyThatDay() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        analyticsRepository.save(buildAnalytics(alice, TARGET,             "**", 1.0));
        analyticsRepository.save(buildAnalytics(alice, TARGET.plusDays(1), "**", 1.0));

        List<Analytics> result = analyticsRepository.findByFriendIdAndDateBetween(
                alice.getId(), TARGET, TARGET);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDate()).isEqualTo(TARGET);
    }

    // ── TC-I10: no entries in range → empty list ─────────────────────────────

    @Test
    void findByFriendIdAndDateBetween_noEntriesInRange_returnsEmpty() {
        Friend alice = friendRepository.save(buildFriend("Alice"));

        List<Analytics> result = analyticsRepository.findByFriendIdAndDateBetween(
                alice.getId(), TARGET, TARGET.plusDays(7));

        assertThat(result).isEmpty();
    }
}
