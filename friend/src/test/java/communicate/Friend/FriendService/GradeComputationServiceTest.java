package communicate.Friend.FriendService;

import communicate.Friend.FriendRepositories.AnalyticsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static communicate.Friend.FriendService.FsrsService.GRADE_EASY;
import static communicate.Friend.FriendService.FsrsService.GRADE_GOOD;
import static communicate.Friend.FriendService.FsrsService.GRADE_HARD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

/**
 * The design doc's "State Translation Design" — collapsing duration,
 * intensity (experience), and proximity into one FSRS grade. Duration's
 * minmax bounds come from AnalyticsRepository (mocked here); intensity's
 * bounds are the fixed 1.0-3.0 star scale.
 */
@ExtendWith(MockitoExtension.class)
class GradeComputationServiceTest {

    @Mock AnalyticsRepository analyticsRepository;

    GradeComputationService service;
    EmaMathService emaMath = new EmaMathService();

    @BeforeEach
    void setUp() {
        // Duration range observed across all logged interactions: 0-4 hours.
        lenient().when(analyticsRepository.findMinHours()).thenReturn(0.0);
        lenient().when(analyticsRepository.findMaxHours()).thenReturn(4.0);
        service = new GradeComputationService(analyticsRepository, emaMath);
    }

    @Test
    void longExcellentInPersonChat_gradesEasy() {
        // duration_norm = 4/4 = 1.0, intensity_norm = (3-1)/(3-1) = 1.0
        // base = 1.0, x1.15 in-person -> clamped to 1.0 -> Easy (>= 0.70)
        int grade = service.computeGrade(4.0, "***", true);
        assertThat(grade).isEqualTo(GRADE_EASY);
    }

    @Test
    void shortPoorRemoteChat_gradesHard() {
        // duration_norm = 0, intensity_norm = 0, base = 0, x1.0 remote = 0 -> Hard
        int grade = service.computeGrade(0.0, "*", false);
        assertThat(grade).isEqualTo(GRADE_HARD);
    }

    @Test
    void midRangeChat_gradesGood() {
        // duration_norm = 2/4 = 0.5, intensity_norm = (2-1)/2 = 0.5, base = 0.5
        // x1.0 remote = 0.5 -> Good (0.40 <= x < 0.70)
        int grade = service.computeGrade(2.0, "**", false);
        assertThat(grade).isEqualTo(GRADE_GOOD);
    }

    @Test
    void inPersonMultiplier_canPushAGoodChatIntoEasy() {
        // duration_norm = 0.5, intensity_norm = 0.5, base = 0.5, x1.15 = 0.575 -> still Good
        int remote = service.computeGrade(2.0, "**", false);
        // A slightly-longer in-person chat crossing the 0.70 boundary via the multiplier:
        // duration_norm = 3/4=0.75, intensity_norm=0.5 -> base=0.625, x1.15=0.71875 -> Easy
        int inPerson = service.computeGrade(3.0, "**", true);
        assertThat(remote).isEqualTo(GRADE_GOOD);
        assertThat(inPerson).isEqualTo(GRADE_EASY);
    }

    @Test
    void unknownProximity_treatedAsRemoteMultiplier() {
        int withNullProximity = service.computeGrade(2.0, "**", null);
        int withFalseProximity = service.computeGrade(2.0, "**", false);
        assertThat(withNullProximity).isEqualTo(withFalseProximity);
    }

    @Test
    void noHistoryYet_fallsBackToNeutralNormalization() {
        lenient().when(analyticsRepository.findMinHours()).thenReturn(null);
        lenient().when(analyticsRepository.findMaxHours()).thenReturn(null);
        GradeComputationService noHistoryService = new GradeComputationService(analyticsRepository, emaMath);

        // duration_norm defaults to 0.5 (degenerate range), intensity_norm for "**" = 0.5
        // base = 0.5, x1.0 remote = 0.5 -> Good
        int grade = noHistoryService.computeGrade(1.5, "**", false);
        assertThat(grade).isEqualTo(GRADE_GOOD);
    }

    @Test
    void degenerateRange_singleDistinctValue_fallsBackToNeutral() {
        lenient().when(analyticsRepository.findMinHours()).thenReturn(2.0);
        lenient().when(analyticsRepository.findMaxHours()).thenReturn(2.0); // max <= min
        GradeComputationService degenerateService = new GradeComputationService(analyticsRepository, emaMath);

        int grade = degenerateService.computeGrade(2.0, "**", false);
        assertThat(grade).isEqualTo(GRADE_GOOD); // 0.5 duration_norm x 0.5 intensity_norm avg = 0.5
    }
}
