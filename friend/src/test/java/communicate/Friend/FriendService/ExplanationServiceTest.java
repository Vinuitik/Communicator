package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.Friend;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ExplanationServiceTest {

    private final ExplanationService service = new ExplanationService(WebClient.builder().build());
    private final Friend friend = Friend.builder().name("Alice").build();
    private final LocalDate due = LocalDate.parse("2026-08-14");

    @Test
    void easyGrade_mentionsExcellentChat() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_EASY, 1.0, null);
        assertThat(text).contains("excellent").contains("Alice").contains("2026-08-14");
    }

    @Test
    void hardGrade_mentionsLowerEnergy() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_HARD, 1.0, null);
        assertThat(text).contains("shorter or lower-energy");
    }

    @Test
    void goodGrade_defaultPhrasing() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.0, null);
        assertThat(text).contains("went well");
    }

    @Test
    void inPersonTrue_mentionsMeetingInPerson() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.0, true);
        assertThat(text).contains("meeting in person");
    }

    @Test
    void inPersonFalse_mentionsRemote() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.0, false);
        assertThat(text).contains("catching up remotely");
    }

    @Test
    void inPersonNull_omitsProximityClause() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.0, null);
        assertThat(text).doesNotContain("in person").doesNotContain("remotely");
    }

    @Test
    void armGreaterThanOne_mentionsStretching() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.5, null);
        assertThat(text).contains("stretching the interval");
    }

    @Test
    void armLessThanOne_mentionsPullingIn() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 0.85, null);
        assertThat(text).contains("pulling the date in");
    }

    @Test
    void armExactlyOne_noArmClause() {
        String text = service.explainTemplate(friend, due, FsrsService.GRADE_GOOD, 1.0, null);
        assertThat(text).doesNotContain("stretching").doesNotContain("pulling");
    }

    @Test
    void hostWrapperUnreachable_fallsBackToTemplateUnchanged() {
        ReflectionTestUtils.setField(service, "hostWrapperUrl", "http://127.0.0.1:1");
        String template = "Suggesting 2026-08-14 for Alice.";
        String result = service.explainViaLlm(template);
        assertThat(result).isEqualTo(template);
    }
}
