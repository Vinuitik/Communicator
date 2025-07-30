package com.communicator.chrono.dto;

import lombok.Data;

@Data
public class FriendUpdateRequest {
    private Integer id;
    private Double averageFrequency;
    private Double averageDuration;
    private Double averageExcitement;
}
