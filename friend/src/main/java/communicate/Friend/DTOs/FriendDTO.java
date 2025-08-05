package communicate.Friend.DTOs;

import java.time.LocalDate;

public record FriendDTO(Integer id, String name, String experience, LocalDate dateOfBirth, LocalDate plannedSpeakingTime,
                       Double averageFrequency, Double averageDuration, Double averageExcitement, Boolean isBirthdayThisWeek) {
    
}
