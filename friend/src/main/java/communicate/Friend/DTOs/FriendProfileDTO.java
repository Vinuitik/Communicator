package communicate.Friend.DTOs;

import java.time.LocalDate;

// JSON shape for the profile.html SPA port — mirrors what WebController.profile's
// Thymeleaf model assembled server-side (friend fields + a resolved primary photo name).
public record FriendProfileDTO(Integer id, String name, String relationshipType, LocalDate dateMet, String mainPhotoName) {

}
