package communicate.Friend.FriendService;

import java.time.Duration;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import communicate.Friend.FriendEntities.Friend;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * (Stretch, design doc Next Steps #11) LLM-drafted outreach-message
 * suggestion via host-wrapper — closes insight -> action in one surface
 * (the independent second opinion's framing): ExplanationService already
 * says WHY a friend is due; this drafts what to actually SEND them.
 *
 * On-demand only (triggered by an explicit UI action, not computed
 * automatically like the scheduling explanation) — an LLM call per button
 * click is the "small controlled" usage the design doc calls for, not a
 * background job. Returns null on any failure; unlike ExplanationService
 * there's no template fallback to show, since a wrong drafted message is
 * worse than no message — the caller surfaces the failure instead.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutreachService {

    private final WebClient webTemplate;

    @Value("${host-wrapper.url:http://host-wrapper:5011}")
    private String hostWrapperUrl;

    public String draftOutreachMessage(Friend friend) {
        String context = friend.getSchedulingExplanation() != null
            ? friend.getSchedulingExplanation()
            : "It's about time to reach out to " + friend.getName() + ".";

        try {
            Map<String, Object> body = Map.of(
                "system", "You draft short, casual outreach messages a user can send a friend to "
                    + "reconnect. Reply with exactly one message draft, 1-3 sentences, warm and "
                    + "low-pressure. Don't invent shared memories, plans, or details not present in "
                    + "the given context.",
                "prompt", "Friend's name: " + friend.getName() + ". Scheduling context: " + context,
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
            log.warn("[Outreach] host-wrapper call failed: {}", e.getMessage());
        }
        return null;
    }
}
