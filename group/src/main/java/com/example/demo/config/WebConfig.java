package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class WebConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF protection
            .csrf(csrf -> csrf.disable())
            // Disable sessions completely
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Allow all requests without authentication
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
            // Disable security headers that might interfere
            .headers(headers -> headers.frameOptions().disable());
        
        return http.build();
    }
}
