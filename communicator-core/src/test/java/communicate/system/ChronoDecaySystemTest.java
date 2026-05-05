package communicate.system;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.system.support.AbstractSystemTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * System tests for the /chrono endpoints.
 * Verifies the full decay pipeline: HTTP trigger → ChronoJobService → DB save.
 *
 * Because these tests commit real data (no @Transactional), cleanup is done
 * manually in @AfterEach.
 */
class ChronoDecaySystemTest extends AbstractSystemTest {

    @Autowired FriendRepository    friendRepository;
    @Autowired AnalyticsRepository analyticsRepository;

    private final List<Integer> createdFriendIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        createdFriendIds.forEach(id -> {
            analyticsRepository.deleteAll(analyticsRepository.findByFriendIdAndDateBetween(
                    id, LocalDate.now().minusYears(1), LocalDate.now().plusYears(1)));
            friendRepository.findById(id).ifPresent(friendRepository::delete);
        });
        createdFriendIds.clear();
    }

    // ── TC-S12: trigger decay → friend without interaction gets decayed ───────

    @Test
    void triggerDecay_friendWithNoInteractionYesterday_averagesDecrease() throws Exception {
        Friend friend = friendRepository.save(Friend.builder()
                .name("Decay Test Friend")
                .plannedSpeakingTime(LocalDate.now().plusDays(7))
                .experience("**")
                .averageFrequency(1.0)
                .averageDuration(1.0)
                .averageExcitement(1.0)
                .build());
        createdFriendIds.add(friend.getId());

        mockMvc.perform(post("/chrono/trigger-decay"))
                .andExpect(status().isOk());

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        assertThat(reloaded.getAverageFrequency()).isLessThan(1.0);
        assertThat(reloaded.getAverageDuration()).isLessThan(1.0);
        assertThat(reloaded.getAverageExcitement()).isLessThan(1.0);
    }

    // ── TC-S13: health endpoint → 200 ────────────────────────────────────────

    @Test
    void chronoHealth_returns200() throws Exception {
        mockMvc.perform(post("/chrono/health"))
                .andExpect(status().isOk());
    }

    // ── TC-S14: trigger-decay returns 200 on empty DB ────────────────────────

    @Test
    void triggerDecay_emptyDatabase_returns200() throws Exception {
        mockMvc.perform(post("/chrono/trigger-decay"))
                .andExpect(status().isOk());
    }
}
