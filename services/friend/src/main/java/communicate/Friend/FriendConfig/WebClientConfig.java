package communicate.Friend.FriendConfig;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

// Bean names are module-qualified so friend/group WebClient configs coexist in
// the merged monolith. The WebClient bean is named "webTemplate" to match its
// only consumer (FriendService FileWriteService.webTemplate) via name-based autowiring.
@Configuration("friendWebClientConfig")
public class WebClientConfig {

    @Bean("webTemplate")
    public WebClient webClient(@Value("${file.repository.service.url:http://localhost:8080}") String baseUrl) {
        return WebClient.builder()
            .baseUrl(baseUrl)
            .build();
    }
}