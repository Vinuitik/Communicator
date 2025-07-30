package com.communicator.chrono.controller;

import com.communicator.chrono.service.ChronoJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/chrono")
@RequiredArgsConstructor
public class ChronoController {

    private final ChronoJobService chronoJobService;

    /**
     * Manual trigger for decay process (for testing)
     */
    @PostMapping("/trigger-decay")
    public ResponseEntity<String> triggerManualDecay() {
        log.info("Manual decay triggered via API");
        
        try {
            chronoJobService.triggerManualDecay();
            return ResponseEntity.ok("Daily decay process triggered successfully");
        } catch (Exception e) {
            log.error("Error during manual decay", e);
            return ResponseEntity.internalServerError()
                    .body("Error during decay process: " + e.getMessage());
        }
    }

    /**
     * Health check endpoint
     */
    @PostMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Chrono service is running");
    }
}
