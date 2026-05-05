package communicate.integration.security;

import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class WebConfigSecurityIT extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;

    // ── TC-I26: CORS preflight from nginx origin → 204 allowed ───────────────

    @Test
    void corsPreflightFromNginx_returns204() throws Exception {
        mockMvc.perform(options("/chrono/health")
                .header("Origin", "http://nginx")
                .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk()); // Spring Security CORS returns 200 for preflight
    }

    // ── TC-I27: no auth token needed — all requests are permitted ─────────────

    @Test
    void getRequestWithoutAuth_returns2xxNotUnauthorized() throws Exception {
        mockMvc.perform(get("/friends/count"))
                .andExpect(status().is2xxSuccessful());
    }

    // ── TC-I28: CSRF disabled — POST without token is accepted ───────────────

    @Test
    void postWithoutCsrfToken_notRejectedWith403() throws Exception {
        // /chrono/health is a POST endpoint — should be reachable without CSRF token
        mockMvc.perform(post("/chrono/health"))
                .andExpect(status().isOk());
    }
}
