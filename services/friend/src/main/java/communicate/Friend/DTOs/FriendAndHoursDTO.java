package communicate.Friend.DTOs;

import communicate.Friend.FriendEntities.Friend;
import lombok.Data;

@Data
public class FriendAndHoursDTO {
    private Friend friend;
    private Double hours;
}
