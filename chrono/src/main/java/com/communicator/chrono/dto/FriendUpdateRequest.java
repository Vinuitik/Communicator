package com.communicator.chrono.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FriendUpdateRequest {
    private Integer id;
    private Double averageFrequency;
    private Double averageDuration;
    private Double averageExcitement;
}
