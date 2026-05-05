package communicate.system;

import communicate.system.support.AbstractSystemTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * System tests for the Friend REST API.
 *
 * These tests call through the full Spring MVC stack (security, validation,
 * service, repository) against a real PostgreSQL database.
 *
 * FriendController routes are at root (nginx strips /api/friend/ prefix);
 * in the monolith we call them directly at their unmapped paths.
 */
class FriendApiSystemTest extends AbstractSystemTest {

    // ── TC-S01: create friend → 2xx response ─────────────────────────────────

    @Test
    void addFriend_validPayload_returns2xx() throws Exception {
        mockMvc.perform(post("/addFriend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(friendJson("Alice")))
                .andExpect(status().is2xxSuccessful());
    }

    // ── TC-S02: create friend with missing required field → 4xx ──────────────

    @Test
    void addFriend_missingName_returns4xx() throws Exception {
        mockMvc.perform(post("/addFriend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plannedSpeakingTime": "2025-01-01", "experience": "**"}
                                """))
                .andExpect(status().is4xxClientError());
    }

    // ── TC-S03: get all friends → 200 ────────────────────────────────────────

    @Test
    void getAllFriends_returns200() throws Exception {
        mockMvc.perform(get("/allFriends"))
                .andExpect(status().isOk());
    }

    // ── TC-S04: get friend count → 200 with numeric body ─────────────────────

    @Test
    void getFriendsCount_returns200AndNumericBody() throws Exception {
        String body = mockMvc.perform(get("/friends/count"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).matches("\\d+");
    }

    // ── TC-S05: paginated friends → 200 ──────────────────────────────────────

    @Test
    void getFriendsPaginated_page0_returns200() throws Exception {
        mockMvc.perform(get("/friends/page/0"))
                .andExpect(status().isOk());
    }

    // ── TC-S06: page beyond data → 200 with empty-ish content (not 500) ──────

    @Test
    void getFriendsPaginated_beyondLastPage_returns200NotServerError() throws Exception {
        mockMvc.perform(get("/friends/page/99999"))
                .andExpect(status().isOk());
    }

    // ── TC-S07: weekly friends endpoint exists ────────────────────────────────

    @Test
    void thisWeek_returns200() throws Exception {
        mockMvc.perform(get("/thisWeek"))
                .andExpect(status().isOk());
    }
}
