package communicate.unit.chrono;

import communicate.Chrono.config.ChronoProperties;
import communicate.Chrono.dto.AnalyticsEntry;
import communicate.Chrono.service.MovingAverageCalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@Tag("unit")
class MovingAverageCalculationServiceTest {

    private MovingAverageCalculationService service;
    private static final LocalDate CALC_DATE = LocalDate.of(2024, 6, 15);
    private static final double TOLERANCE = 0.0001;

    @BeforeEach
    void setUp() {
        ChronoProperties props = new ChronoProperties();
        ChronoProperties.Coefficients coefficients = new ChronoProperties.Coefficients();
        coefficients.setDecay(Map.of("excellent", 0.07, "good", 0.2, "poor", 0.57));
        props.setCoefficients(coefficients);
        service = new MovingAverageCalculationService(props);
    }

    // ── TC-U01: single entry, experience "***", starting from zero ─────────────

    @Test
    void singleExcellentEntry_fromZero_producesCorrectEma() {
        AnalyticsEntry entry = entry(CALC_DATE, "***", 2.0);

        var result = service.calculateMovingAverages(List.of(entry), 0.0, 0.0, 0.0, CALC_DATE);

        // alpha for new *** data = 0.6
        // frequencyEma = 0.6 * 1 + 0.4 * 0 = 0.6
        // excitementEma = 0.6 * 3.0 + 0.4 * 0 = 1.8
        // durationEma = 0.6 * 2.0 + 0.4 * 0 = 1.2
        assertThat(result.frequency()).isCloseTo(0.6, within(TOLERANCE));
        assertThat(result.excitement()).isCloseTo(1.8, within(TOLERANCE));
        assertThat(result.duration()).isCloseTo(1.2, within(TOLERANCE));
    }

    // ── TC-U02: experience mapping — "***"=3.0, "**"=2.0, "*"=1.0 ─────────────

    @Test
    void experienceMapping_excellent_mapsToThree() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, "***", 0.0)), 0.0, 0.0, 0.0, CALC_DATE);
        // excitement = 0.6 * 3.0
        assertThat(result.excitement()).isCloseTo(1.8, within(TOLERANCE));
    }

    @Test
    void experienceMapping_good_mapsToTwo() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, "**", 0.0)), 0.0, 0.0, 0.0, CALC_DATE);
        // alpha for ** = 0.3, excitement = 0.3 * 2.0
        assertThat(result.excitement()).isCloseTo(0.6, within(TOLERANCE));
    }

    @Test
    void experienceMapping_poor_mapsToOne() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, "*", 0.0)), 0.0, 0.0, 0.0, CALC_DATE);
        // alpha for * = 0.15, excitement = 0.15 * 1.0
        assertThat(result.excitement()).isCloseTo(0.15, within(TOLERANCE));
    }

    @Test
    void experienceMapping_unknown_mapsToZero() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, "unknown_value", 0.0)), 0.0, 0.0, 0.0, CALC_DATE);
        // excitement = alpha * 0.0 = 0
        assertThat(result.excitement()).isCloseTo(0.0, within(TOLERANCE));
    }

    @Test
    void experienceMapping_null_mapsToZero() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, null, 0.0)), 0.0, 0.0, 0.0, CALC_DATE);
        assertThat(result.excitement()).isCloseTo(0.0, within(TOLERANCE));
    }

    // ── TC-U03: multiple same-day entries accumulate frequency and duration ─────

    @Test
    void multipleSameDayEntries_accumulateFrequencyAndDuration() {
        // Two meetings on the same day: frequency=2, total duration=3.0
        var e1 = entry(CALC_DATE, "***", 1.0);
        var e2 = entry(CALC_DATE, "***", 2.0);

        var single = service.calculateMovingAverages(List.of(e1), 0.0, 0.0, 0.0, CALC_DATE);
        var both   = service.calculateMovingAverages(List.of(e1, e2), 0.0, 0.0, 0.0, CALC_DATE);

        // Frequency should be higher with 2 entries (count=2 vs count=1)
        assertThat(both.frequency()).isGreaterThan(single.frequency());
        // Duration should be higher (3.0 vs 1.0)
        assertThat(both.duration()).isGreaterThan(single.duration());
    }

    // ── TC-U04: empty analytics list → pure decay on current values ───────────

    @Test
    void emptyAnalytics_appliesDecayToCurrentValues() {
        var result = service.calculateMovingAverages(List.of(), 1.0, 1.0, 1.0, CALC_DATE);

        // Default experience "*" → decayAlpha=0.57, factor=(1-0.57)=0.43
        assertThat(result.frequency()).isCloseTo(0.43, within(TOLERANCE));
        assertThat(result.duration()).isCloseTo(0.43, within(TOLERANCE));
        assertThat(result.excitement()).isCloseTo(0.43, within(TOLERANCE));
    }

    // ── TC-U05: null starting values → no NPE, treated as zero ───────────────

    @Test
    void nullStartingValues_treatedAsZero() {
        var result = service.calculateMovingAverages(
                List.of(entry(CALC_DATE, "***", 1.0)), null, null, null, CALC_DATE);

        assertThat(result.frequency()).isGreaterThanOrEqualTo(0.0);
        assertThat(result.duration()).isGreaterThanOrEqualTo(0.0);
        assertThat(result.excitement()).isGreaterThanOrEqualTo(0.0);
    }

    // ── TC-U06: zero starting values stay non-negative after decay ────────────

    @Test
    void zeroStartingValues_stayZeroAfterDecay() {
        var result = service.calculateMovingAverages(List.of(), 0.0, 0.0, 0.0, CALC_DATE);

        assertThat(result.frequency()).isCloseTo(0.0, within(TOLERANCE));
        assertThat(result.duration()).isCloseTo(0.0, within(TOLERANCE));
        assertThat(result.excitement()).isCloseTo(0.0, within(TOLERANCE));
    }

    // ── TC-U07: two-day window, good day then no activity → decay on day 2 ────

    @Test
    void twoDays_activityThenSilence_emaDecaysOnSecondDay() {
        LocalDate day1 = CALC_DATE.minusDays(1);
        AnalyticsEntry entry = entry(day1, "***", 1.0);

        // calculationDate = CALC_DATE, entry is on day1 (yesterday)
        // day1: alpha=0.6, ema updates with data
        // day2 (CALC_DATE): no data, decay applied with alpha=0.07 (*** decay)
        var result = service.calculateMovingAverages(List.of(entry), 0.0, 0.0, 0.0, CALC_DATE);

        // After day1: frequencyEma ≈ 0.6
        // After decay on day2: frequencyEma = 0.07*0 + 0.93*0.6 = 0.558
        assertThat(result.frequency()).isCloseTo(0.558, within(TOLERANCE));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private AnalyticsEntry entry(LocalDate date, String experience, double hours) {
        AnalyticsEntry e = new AnalyticsEntry();
        e.setDate(date);
        e.setExperience(experience);
        e.setHours(hours);
        return e;
    }
}
