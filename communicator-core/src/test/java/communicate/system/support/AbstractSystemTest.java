package communicate.system.support;

import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Base class for system tests.
 *
 * Uses a real embedded Tomcat (RANDOM_PORT) and MockMvc so the full
 * Spring MVC dispatch stack is exercised, including filters and security.
 *
 * NOTE: @Transactional is intentionally absent — HTTP requests execute in
 * separate threads and their transactions commit before the test can inspect
 * the database. Use @AfterEach + repository.deleteAll() in subclasses for cleanup.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
@Tag("system")
public abstract class AbstractSystemTest {

    @Container
    protected static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:17-alpine")
                    .withDatabaseName("communicator_system_test")
                    .withUsername("sys_user")
                    .withPassword("sys_pass");

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("SPRING_DATASOURCE_URL", postgres::getJdbcUrl);
        registry.add("SPRING_DATASOURCE_USERNAME", postgres::getUsername);
        registry.add("SPRING_DATASOURCE_PASSWORD", postgres::getPassword);
    }

    @Autowired
    protected MockMvc mockMvc;

    // ── Shared HTTP helpers ────────────────────────────────────────────────────

    protected String postJson(String url, String body) throws Exception {
        MvcResult result = mockMvc.perform(
                post(url)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn();
        return result.getResponse().getContentAsString();
    }

    protected String friendJson(String name) {
        return """
                {
                  "name": "%s",
                  "plannedSpeakingTime": "%s",
                  "experience": "**"
                }
                """.formatted(name, java.time.LocalDate.now().plusDays(7));
    }
}
