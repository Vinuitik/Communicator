package com.communicator.chrono.service;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.chrono.dto.AnalyticsEntry;
import com.communicator.chrono.dto.FriendSummary;
import com.communicator.chrono.dto.FriendUpdateRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FriendServiceClient {

    private final ChronoProperties chronoProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Get all friends with their current moving averages
     * @deprecated Use getFriendsPaginated for better performance at scale
     */
    @Deprecated
    public List<FriendSummary> getAllFriends() {
        try {
            String url = chronoProperties.getFriendService().getBaseUrl() + "/shortList";
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), new TypeReference<List<FriendSummary>>() {});
            } else {
                log.error("Failed to get friends list. Status: {}, Body: {}", 
                         response.statusCode(), response.body());
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("Error getting friends list", e);
            return new ArrayList<>();
        }
    }

    /**
     * Get friends paginated for chrono processing
     * This is much more memory efficient than loading all friends at once
     */
    public List<FriendSummary> getFriendsPaginated(int page, int size) {
        try {
            String url = String.format("%s/friends/chrono/page/%d/size/%d",
                    chronoProperties.getFriendService().getBaseUrl(), page, size);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), new TypeReference<List<FriendSummary>>() {});
            } else {
                log.error("Failed to get friends page {}. Status: {}, Body: {}", 
                         page, response.statusCode(), response.body());
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("Error getting friends page {}", page, e);
            return new ArrayList<>();
        }
    }

    /**
     * Get total count of friends for pagination calculations
     */
    public long getFriendsCount() {
        try {
            String url = chronoProperties.getFriendService().getBaseUrl() + "/friends/count";
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return Long.parseLong(response.body());
            } else {
                log.error("Failed to get friends count. Status: {}, Body: {}", 
                         response.statusCode(), response.body());
                return 0;
            }
        } catch (Exception e) {
            log.error("Error getting friends count", e);
            return 0;
        }
    }

    /**
     * Get analytics data for a specific friend for a date range
     */
    public List<AnalyticsEntry> getFriendAnalytics(Integer friendId, LocalDate startDate, LocalDate endDate) {
        try {
            String url = String.format("%s/analyticsList?friendId=%d&left=%s&right=%s",
                    chronoProperties.getFriendService().getBaseUrl(),
                    friendId,
                    startDate.toString(),
                    endDate.toString());
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), new TypeReference<List<AnalyticsEntry>>() {});
            } else {
                log.error("Failed to get analytics for friend {}. Status: {}, Body: {}", 
                         friendId, response.statusCode(), response.body());
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("Error getting analytics for friend {}", friendId, e);
            return new ArrayList<>();
        }
    }

    /**
     * Batch check: Get list of friend IDs who had interactions on a specific date
     * This is much more efficient than individual calls for each friend
     */
    public List<Integer> getFriendsWithInteractionsOnDate(List<Integer> friendIds, LocalDate date) {
        try {
            String url = chronoProperties.getFriendService().getBaseUrl() + "/batch-interaction-check?date=" + date.toString();
            String jsonBody = objectMapper.writeValueAsString(friendIds);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), new TypeReference<List<Integer>>() {});
            } else {
                log.error("Failed to batch check interactions for date {}. Status: {}, Body: {}", 
                         date, response.statusCode(), response.body());
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("Error in batch interaction check for date {}", date, e);
            return new ArrayList<>();
        }
    }

    /**
     * Check if a friend had any interaction on a specific date
     * @deprecated Use getFriendsWithInteractionsOnDate for better performance
     */
    @Deprecated
    public boolean hadInteractionOnDate(Integer friendId, LocalDate date) {
        try {
            String url = String.format("%s/analyticsList?friendId=%d&left=%s&right=%s",
                    chronoProperties.getFriendService().getBaseUrl(),
                    friendId,
                    date.toString(),
                    date.toString());
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                List<AnalyticsEntry> entries = objectMapper.readValue(response.body(), new TypeReference<List<AnalyticsEntry>>() {});
                return !entries.isEmpty();
            } else {
                log.error("Failed to check interaction for friend {} on date {}. Status: {}", 
                         friendId, date, response.statusCode());
                return false;
            }
        } catch (Exception e) {
            log.error("Error checking interaction for friend {} on date {}", friendId, date, e);
            return false;
        }
    }

    /**
     * Update friend's moving averages
     */
    public boolean updateFriendAverages(FriendUpdateRequest updateRequest) {
        try {
            String url = chronoProperties.getFriendService().getBaseUrl() + "/updateAverages";
            String jsonBody = objectMapper.writeValueAsString(updateRequest);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(chronoProperties.getFriendService().getTimeout()))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                log.debug("Successfully updated averages for friend {}", updateRequest.getId());
                return true;
            } else {
                log.error("Failed to update averages for friend {}. Status: {}, Body: {}", 
                         updateRequest.getId(), response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Error updating averages for friend {}", updateRequest.getId(), e);
            return false;
        }
    }
}
