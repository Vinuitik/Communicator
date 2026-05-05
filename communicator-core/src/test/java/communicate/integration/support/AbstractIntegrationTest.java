package communicate.integration.support;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendEvent;
import communicate.Friend.FriendEntities.FriendKnowledge;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;

/**
 * Base class for all integration tests.
 *
 * Starts one shared PostgreSQL container (singleton per JVM run) and wires
 * it into the Spring datasource via @DynamicPropertySource.
 *
 * @Transactional on this class means every test method rolls back automatically —
 * no manual cleanup needed.
 */
@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@Transactional
@Tag("integration")
public abstract class AbstractIntegrationTest {

    @Container
    protected static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:17-alpine")
                    .withDatabaseName("communicator_test")
                    .withUsername("test_user")
                    .withPassword("test_pass");

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("SPRING_DATASOURCE_URL", postgres::getJdbcUrl);
        registry.add("SPRING_DATASOURCE_USERNAME", postgres::getUsername);
        registry.add("SPRING_DATASOURCE_PASSWORD", postgres::getPassword);
    }

    // ── Test data builders ─────────────────────────────────────────────────────

    protected Friend buildFriend(String name) {
        return Friend.builder()
                .name(name)
                .plannedSpeakingTime(LocalDate.now().plusDays(7))
                .experience("**")
                .build();
    }

    protected Friend buildFriendWithAverages(String name, double freq, double dur, double exc) {
        return Friend.builder()
                .name(name)
                .plannedSpeakingTime(LocalDate.now().plusDays(7))
                .experience("**")
                .averageFrequency(freq)
                .averageDuration(dur)
                .averageExcitement(exc)
                .build();
    }

    protected Analytics buildAnalytics(Friend friend, LocalDate date, String experience, double hours) {
        return Analytics.builder()
                .friend(friend)
                .date(date)
                .experience(experience)
                .hours(hours)
                .build();
    }

    protected FriendKnowledge buildKnowledge(Friend friend, String text, long priority) {
        return FriendKnowledge.builder()
                .friend(friend)
                .text(text)
                .priority(priority)
                .date(LocalDate.now())
                .build();
    }

    protected FriendEvent buildEvent(Friend friend, boolean active) {
        return FriendEvent.builder()
                .friend(friend)
                .eventType("Catch-up")
                .title("Regular catch-up")
                .baseDate(LocalDate.now().minusDays(10))
                .recurrenceDays(30)
                .active(active)
                .build();
    }
}
