package communicate.Chrono.dto;

import lombok.Data;

@Data
public class FriendSummary {
    private Integer id;
    private String name;
    private Double averageFrequency;
    private Double averageDuration;
    private Double averageExcitement;
}

