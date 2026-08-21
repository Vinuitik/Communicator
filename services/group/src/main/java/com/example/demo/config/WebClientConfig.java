package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

// Module-qualified config bean name; WebClient bean stays "webClient" to match
// its consumer (GroupFileService.webClient) via name-based autowiring.
@Configuration("groupWebClientConfig")
public class WebClientConfig {

    @Value("${resource.repository.url}")
    private String resourceRepositoryUrl;

    @Bean("webClient")
    public WebClient webClient() {
        return WebClient.builder()
                .baseUrl(resourceRepositoryUrl)
                .build();
    }
}
