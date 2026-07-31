package communicate.Friend.FriendService;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import communicate.Friend.FriendEntities.Friend;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * "Why this due date" explanation surfaced next to plannedSpeakingTime
 * (design doc Next Steps #9 — the payoff the user got most excited about:
 * "a correct-but-opaque scheduler gets ignored; a slightly-off one that
 * explains itself gets used"). Template string always computed first and
 * used as the fallback; a host-wrapper LLM call polishes it into one warm
 * sentence when the gateway is reachable. Never blocks scheduling on the
 * LLM call failing — see explainViaLlm's catch-and-fallback.
 *
 * Calls host-wrapper directly (same /complete contract ai_agent's
 * HostWrapperChatModel uses) rather than routing through ai_agent — this is
 * a single "small controlled" completion (the user's own words), not
 * agentic/tool-using work, so ai_agent's extra hop buys nothing here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExplanationService {

    private final WebClient webTemplate;

    @Value("${host-wrapper.url:http://host-wrapper:5011}")
    private String hostWrapperUrl;

    /** Deterministic, no external call — always available, always the fallback. */
    public String explainTemplate(Friend friend, LocalDate due, int grade, double banditArm, Boolean inPerson) {
        StringBuilder sb = new StringBuilder("Suggesting ").append(due).append(" for ").append(friend.getName());
        sb.append(" — ").append(gradeReason(grade));
        if (inPerson != null) {
            sb.append(inPerson ? ", meeting in person" : ", catching up remotely");
        }
        sb.append(armClause(banditArm));
        sb.append('.');
        return sb.toString();
    }

    /** Best-effort rewrite of the template through host-wrapper; returns the template unchanged on any failure. */
    public String explainViaLlm(String templateExplanation) {
        try {
            Map<String, Object> body = Map.of(
                "system", "You rewrite short scheduling explanations for a personal relationship-tracking "
                    + "app. Reply with exactly one warm, concise sentence. Do not invent facts that aren't "
                    + "already in the given text.",
                "prompt", templateExplanation,
                "priority", "low"
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> response = webTemplate.post()
                .uri(hostWrapperUrl + "/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block(Duration.ofSeconds(8));

            if (response != null && response.get("text") instanceof String text && !text.isBlank()) {
                return text.trim();
            }
        } catch (Exception e) {
            log.warn("[Explanation] host-wrapper call failed, using template explanation: {}", e.getMessage());
        }
        return templateExplanation;
    }

    private static String gradeReason(int grade) {
        return switch (grade) {
            case FsrsService.GRADE_EASY -> "your last chat was excellent";
            case FsrsService.GRADE_HARD -> "your last chat was shorter or lower-energy than usual";
            default -> "your last chat went well";
        };
    }

    private static String armClause(double banditArm) {
        if (banditArm > 1.0) return " — stretching the interval since this rhythm has been reliable";
        if (banditArm < 1.0) return " — pulling the date in a bit while we learn this rhythm";
        return "";
    }
}
