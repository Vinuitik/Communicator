package com.communicator.chrono.service;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.chrono.dto.AnalyticsEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MovingAverageCalculationService {

    private final ChronoProperties chronoProperties;

    /**
     * Calculate exponential moving averages using the same algorithm as analytics.js
     */
    public MovingAverageResult calculateMovingAverages(
            List<AnalyticsEntry> analyticsData, 
            Double currentFrequency, 
            Double currentDuration, 
            Double currentExcitement,
            LocalDate calculationDate) {

        if (analyticsData.isEmpty()) {
            // If no data, apply decay to current values
            return applyDecayToCurrentValues(currentFrequency, currentDuration, currentExcitement, "*");
        }

        // Find the earliest date in our data to determine the range
        LocalDate earliestDate = analyticsData.stream()
                .map(AnalyticsEntry::getDate)
                .min(LocalDate::compareTo)
                .orElse(calculationDate.minusDays(30));

        // Process the data similar to analytics.js
        Map<String, Double> totalDurationByDate = new HashMap<>();
        Map<String, Integer> frequencyByDate = new HashMap<>();
        Map<String, String> lastExperienceByDate = new HashMap<>();

        for (AnalyticsEntry item : analyticsData) {
            String dateStr = item.getDate().toString();
            
            // Update total duration
            totalDurationByDate.merge(dateStr, item.getHours(), Double::sum);
            
            // Update frequency (count of meetings)
            frequencyByDate.merge(dateStr, 1, Integer::sum);
            
            // Store the experience for this date (last one if multiple)
            lastExperienceByDate.put(dateStr, item.getExperience());
        }

        // Generate all dates from earliest to calculation date
        long daysBetween = ChronoUnit.DAYS.between(earliestDate, calculationDate);
        String lastKnownExperience = "*"; // Default
        
        // Get yesterday's data (since we're calculating at midnight for yesterday)
        LocalDate yesterdayDate = calculationDate.minusDays(1);
        String yesterday = yesterdayDate.toString();
        
        // Calculate EMA values step by step, ending with yesterday
        double frequencyEma = currentFrequency != null ? currentFrequency : 0.0;
        double excitementEma = currentExcitement != null ? currentExcitement : 0.0;
        double durationEma = currentDuration != null ? currentDuration : 0.0;

        // Process each day leading up to and including yesterday
        for (long i = 0; i <= daysBetween; i++) {
            LocalDate currentDate = earliestDate.plusDays(i);
            String dateStr = currentDate.toString();
            
            double frequency = frequencyByDate.getOrDefault(dateStr, 0);
            double excitement = convertExperienceToNumber(lastExperienceByDate.get(dateStr));
            double duration = totalDurationByDate.getOrDefault(dateStr, 0.0);
            
            double alpha;
            
            if (frequencyByDate.containsKey(dateStr)) {
                // New data exists for this day
                lastKnownExperience = lastExperienceByDate.get(dateStr);
                alpha = chronoProperties.getNewDataAlpha(lastKnownExperience);
            } else {
                // No new data, apply decay
                alpha = chronoProperties.getDecayAlpha(lastKnownExperience);
            }
            
            // Apply EMA formula: EMA = alpha * current_value + (1 - alpha) * previous_EMA
            frequencyEma = alpha * frequency + (1 - alpha) * frequencyEma;
            excitementEma = alpha * excitement + (1 - alpha) * excitementEma;
            durationEma = alpha * duration + (1 - alpha) * durationEma;
        }

        log.debug("Calculated EMAs for friend - Frequency: {}, Excitement: {}, Duration: {}", 
                 frequencyEma, excitementEma, durationEma);

        return new MovingAverageResult(frequencyEma, excitementEma, durationEma);
    }

    private MovingAverageResult applyDecayToCurrentValues(
            Double currentFrequency, Double currentDuration, Double currentExcitement, String experience) {
        
        double alpha = chronoProperties.getDecayAlpha(experience);
        
        double frequency = currentFrequency != null ? (1 - alpha) * currentFrequency : 0.0;
        double duration = currentDuration != null ? (1 - alpha) * currentDuration : 0.0;
        double excitement = currentExcitement != null ? (1 - alpha) * currentExcitement : 0.0;
        
        return new MovingAverageResult(frequency, excitement, duration);
    }

    private double convertExperienceToNumber(String experience) {
        if (experience == null) return 0.0;
        return switch (experience) {
            case "*" -> 1.0;
            case "**" -> 2.0;
            case "***" -> 3.0;
            default -> 0.0;
        };
    }

    public record MovingAverageResult(double frequency, double excitement, double duration) {}
}
