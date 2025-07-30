package com.communicator.chrono.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class AnalyticsEntry {
    private Integer id;
    private String experience;
    private LocalDate date;
    private Double hours;
}
