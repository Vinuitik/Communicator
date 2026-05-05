package communicate.unit.chrono;

import communicate.Chrono.config.ChronoProperties;
import communicate.Chrono.service.ChronoJobService;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendService.MeetingGenerationService;
import communicate.Chrono.service.MovingAverageCalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the decay arithmetic inside ChronoJobService.
 * Uses Mockito to avoid a real database — exercises the decay math in isolation.
 */
@Tag("unit")
@ExtendWith(MockitoExtension.class)
class ChronoDecayMathTest {

    @Mock FriendRepository friendRepository;
    @Mock AnalyticsRepository analyticsRepository;
    @Mock MeetingGenerationService meetingGenerationService;
    @Mock MovingAverageCalculationService movingAverageCalculationService;

    private ChronoJobService service;
    private static final double TOLERANCE = 0.0001;

    @BeforeEach
    void setUp() {
        ChronoProperties props = new ChronoProperties();
        ChronoProperties.Coefficients coefficients = new ChronoProperties.Coefficients();
        coefficients.setDecay(Map.of("excellent", 0.07, "good", 0.2, "poor", 0.57));
        props.setCoefficients(coefficients);

        service = new ChronoJobService(
                friendRepository, analyticsRepository,
                meetingGenerationService, movingAverageCalculationService, props);

        when(meetingGenerationService.generateMissingNextMeetingsForAllFriends())
                .thenReturn(List.of());
    }

    // ── TC-U21: standard decay with alpha=0.2 ("good") ────────────────────────

    @Test
    void friendWithAverages_noInteractionYesterday_decayApplied() {
        Friend friend = friendWithAverages(1, 1.0, 1.0, 1.0);
        stubSingleFriendPage(friend);
        stubNoInteractions(List.of(1));

        service.applyDailyDecay();

        Friend saved = captureLastSave();
        // alpha=0.2, factor=(1-0.2)=0.8
        assertThat(saved.getAverageFrequency()).isCloseTo(0.8, within(TOLERANCE));
        assertThat(saved.getAverageDuration()).isCloseTo(0.8, within(TOLERANCE));
        assertThat(saved.getAverageExcitement()).isCloseTo(0.8, within(TOLERANCE));
    }

    // ── TC-U22: different starting values all decay correctly ─────────────────

    @Test
    void friendWithDifferentAverages_allDecayByCorrectFactor() {
        Friend friend = friendWithAverages(2, 0.5, 0.3, 0.8);
        stubSingleFriendPage(friend);
        stubNoInteractions(List.of(2));

        service.applyDailyDecay();

        Friend saved = captureLastSave();
        assertThat(saved.getAverageFrequency()).isCloseTo(0.5 * 0.8, within(TOLERANCE));
        assertThat(saved.getAverageDuration()).isCloseTo(0.3 * 0.8, within(TOLERANCE));
        assertThat(saved.getAverageExcitement()).isCloseTo(0.8 * 0.8, within(TOLERANCE));
    }

    // ── TC-U23: friend with null averages — no NPE, result is 0.0 ────────────

    @Test
    void friendWithNullAverages_noNpeAndResultIsZero() {
        Friend friend = friendWithAverages(3, null, null, null);
        stubSingleFriendPage(friend);
        stubNoInteractions(List.of(3));

        service.applyDailyDecay();

        Friend saved = captureLastSave();
        assertThat(saved.getAverageFrequency()).isCloseTo(0.0, within(TOLERANCE));
        assertThat(saved.getAverageDuration()).isCloseTo(0.0, within(TOLERANCE));
        assertThat(saved.getAverageExcitement()).isCloseTo(0.0, within(TOLERANCE));
    }

    // ── TC-U24: friend WITH interaction — save is never called ───────────────

    @Test
    void friendWithInteraction_noDecayApplied() {
        Friend friend = friendWithAverages(4, 1.0, 1.0, 1.0);
        stubSingleFriendPage(friend);
        // Friend 4 had interaction yesterday
        when(analyticsRepository.findFriendIdsWithInteractionsOnDate(anyList(), any(LocalDate.class)))
                .thenReturn(List.of(4));

        service.applyDailyDecay();

        verify(friendRepository, never()).save(any());
    }

    // ── TC-U25: repo save throws — exception caught, does not propagate ───────

    @Test
    void saveThrowsDataAccessException_exceptionCaughtAndLogged() {
        Friend friend = friendWithAverages(5, 1.0, 1.0, 1.0);
        stubSingleFriendPage(friend);
        stubNoInteractions(List.of(5));
        when(friendRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        // Must not throw
        service.applyDailyDecay();
    }

    // ── TC-U26: meeting generation exception — decay still runs ──────────────

    @Test
    void meetingGenerationThrows_decayStillProcessesFriends() {
        when(meetingGenerationService.generateMissingNextMeetingsForAllFriends())
                .thenThrow(new RuntimeException("gRPC dead"));

        Friend friend = friendWithAverages(6, 1.0, 1.0, 1.0);
        stubSingleFriendPage(friend);
        stubNoInteractions(List.of(6));

        service.applyDailyDecay();

        // Decay still applied despite meeting generation failure
        verify(friendRepository, times(1)).save(any());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Friend friendWithAverages(Integer id, Double freq, Double dur, Double exc) {
        Friend f = Friend.builder()
                .name("Test Friend " + id)
                .plannedSpeakingTime(LocalDate.now().plusDays(7))
                .experience("**")
                .averageFrequency(freq)
                .averageDuration(dur)
                .averageExcitement(exc)
                .build();
        // Simulate a persisted ID
        f.setId(id);
        return f;
    }

    private void stubSingleFriendPage(Friend friend) {
        Page<Friend> page = new PageImpl<>(List.of(friend));
        when(friendRepository.count()).thenReturn(1L);
        when(friendRepository.findAll(any(Pageable.class))).thenReturn(page);
    }

    private void stubNoInteractions(List<Integer> friendIds) {
        when(analyticsRepository.findFriendIdsWithInteractionsOnDate(anyList(), any(LocalDate.class)))
                .thenReturn(List.of());
    }

    private Friend captureLastSave() {
        ArgumentCaptor<Friend> captor = ArgumentCaptor.forClass(Friend.class);
        verify(friendRepository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }
}
