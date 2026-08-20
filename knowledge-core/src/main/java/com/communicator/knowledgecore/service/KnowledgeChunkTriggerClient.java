package com.communicator.knowledgecore.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Fires the eager chunk-trigger HTTP call to ai_agent (POST {ai-agent.url}/knowledge/chunk)
 * after a Friend/Group/Connection KnowledgeService add/update commits.
 *
 * This repo's ai_agent container is self-hosted and goes down often — a genuine, common
 * case here, not a rare edge case (see FLOWS/CLAUDE.md notes on self-hosted downtime) — so
 * this call must NEVER block the caller or be able to fail the knowledge save that
 * triggered it. Uses JDK HttpClient's async send (returns immediately, doesn't block the
 * calling thread on the network round trip) plus a belt-and-suspenders try/catch around
 * everything, same spirit as MeetingService.onFriendRescheduled's
 * try/catch-and-log-only-never-rethrow pattern.
 *
 * No RabbitMQ here on purpose — this codebase has RabbitMQ provisioned but deliberately
 * not wired for this kind of trigger yet (a separate, not-yet-scoped effort). Plain HTTP,
 * same convention every other cross-module call in this codebase already uses (see
 * ai_agent/services/friend_api_service.py for the mirror-image direction).
 */
@Component
@Slf4j
public class KnowledgeChunkTriggerClient {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper;
    private final String baseUrl;

    public KnowledgeChunkTriggerClient(
            ObjectMapper objectMapper,
            @Value("${ai-agent.url:http://ai-agent:8001}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
    }

    public void triggerChunk(KnowledgeChunkTriggerEvent event) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("knowledge_id", event.knowledgeId());
            payload.put("source_type", event.sourceType());
            payload.put("friend_id", event.friendId());
            payload.put("group_id", event.groupId());
            payload.put("connection_friend1_id", event.connectionFriend1Id());
            payload.put("connection_friend2_id", event.connectionFriend2Id());
            payload.put("text", event.text());

            String body = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/knowledge/chunk"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            // sendAsync returns immediately — the HTTP round trip (or timeout, or a fully
            // down ai-agent) happens on HttpClient's own executor, never blocking whichever
            // thread the AFTER_COMMIT listener ran on.
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .orTimeout(20, TimeUnit.SECONDS)
                    .whenComplete((response, error) -> {
                        if (error != null) {
                            log.warn("Chunk-trigger POST failed for knowledge {} ({}): {}",
                                    event.knowledgeId(), event.sourceType(), error.getMessage());
                        } else if (response.statusCode() >= 300) {
                            log.warn("Chunk-trigger POST for knowledge {} ({}) returned HTTP {}",
                                    event.knowledgeId(), event.sourceType(), response.statusCode());
                        }
                    });
        } catch (Exception e) {
            // Covers JSON serialization failures and any synchronous setup error before
            // sendAsync is reached — must never propagate out of here.
            log.warn("Failed to dispatch chunk-trigger for knowledge {} ({}): {}",
                    event.knowledgeId(), event.sourceType(), e.getMessage());
        }
    }
}
