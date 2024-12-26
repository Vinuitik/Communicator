package communicate.DTOs;

import communicate.Entities.Friend;
import lombok.Data;

@Data
public class FriendAndHoursDTO {
    private Friend friend;
    private Double hours;
}
