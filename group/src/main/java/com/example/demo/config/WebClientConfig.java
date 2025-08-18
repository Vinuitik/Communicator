package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${resource.repository.url}")
    private String resourceRepositoryUrl;

    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .baseUrl(resourceRepositoryUrl)
                .build();
    }
}
