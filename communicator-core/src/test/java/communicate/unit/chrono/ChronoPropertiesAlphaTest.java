package communicate.unit.chrono;

import communicate.Chrono.config.ChronoProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@Tag("unit")
class ChronoPropertiesAlphaTest {

    private ChronoProperties props;
    private static final double TOLERANCE = 0.0001;

    @BeforeEach
    void setUp() {
        props = new ChronoProperties();
        ChronoProperties.Coefficients coefficients = new ChronoProperties.Coefficients();
        coefficients.setDecay(Map.of("excellent", 0.07, "good", 0.2, "poor", 0.57));
        props.setCoefficients(coefficients);
    }

    // ── TC-U11-13: decay alpha for known experiences ───────────────────────────

    @Test void decayAlpha_excellent_returns007() {
        assertThat(props.getDecayAlpha("***")).isCloseTo(0.07, within(TOLERANCE));
    }

    @Test void decayAlpha_good_returns02() {
        assertThat(props.getDecayAlpha("**")).isCloseTo(0.2, within(TOLERANCE));
    }

    @Test void decayAlpha_poor_returns057() {
        assertThat(props.getDecayAlpha("*")).isCloseTo(0.57, within(TOLERANCE));
    }

    // ── TC-U14-17: decay alpha fallback behaviour ──────────────────────────────

    @Test void decayAlpha_unknownString_returnsDefault() {
        assertThat(props.getDecayAlpha("not_a_rating")).isCloseTo(0.2, within(TOLERANCE));
    }

    @Test void decayAlpha_null_returnsDefaultWithoutNpe() {
        assertThat(props.getDecayAlpha(null)).isCloseTo(0.2, within(TOLERANCE));
    }

    @Test void decayAlpha_nullCoefficients_returnsDefault() {
        props.setCoefficients(null);
        assertThat(props.getDecayAlpha("***")).isCloseTo(0.2, within(TOLERANCE));
    }

    @Test void decayAlpha_nullDecayMap_returnsDefault() {
        props.getCoefficients().setDecay(null);
        assertThat(props.getDecayAlpha("***")).isCloseTo(0.2, within(TOLERANCE));
    }

    // ── TC-U18-20: newData alpha for known experiences ────────────────────────

    @Test void newDataAlpha_excellent_returns06() {
        assertThat(props.getNewDataAlpha("***")).isCloseTo(0.6, within(TOLERANCE));
    }

    @Test void newDataAlpha_good_returns03() {
        assertThat(props.getNewDataAlpha("**")).isCloseTo(0.3, within(TOLERANCE));
    }

    @Test void newDataAlpha_poor_returns015() {
        assertThat(props.getNewDataAlpha("*")).isCloseTo(0.15, within(TOLERANCE));
    }

    @Test void newDataAlpha_unknown_returnsDefault() {
        assertThat(props.getNewDataAlpha("???")).isCloseTo(0.3, within(TOLERANCE));
    }

    // ── Sanity: decay alpha is always in (0, 1) ───────────────────────────────

    @Test void allDecayAlphas_areValidProbabilities() {
        for (String exp : new String[]{"***", "**", "*", null, "unknown"}) {
            double alpha = props.getDecayAlpha(exp);
            assertThat(alpha).isBetween(0.0, 1.0);
        }
    }
}
