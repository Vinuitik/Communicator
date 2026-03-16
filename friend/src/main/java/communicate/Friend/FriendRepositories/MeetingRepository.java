package communicate.Friend.FriendRepositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Meeting;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, Integer> {
    List<Meeting> findByFriendId(Integer friendId);

    List<Meeting> findByFriendIdAndMeetingDateAfter(Integer friendId, LocalDate meetingDate);

    java.util.Optional<Meeting> findByIdAndFriendId(Integer id, Integer friendId);

    List<Meeting> findByMeetingDateAfterOrderByMeetingDateAsc(LocalDate meetingDate);

    boolean existsByEventIdAndMeetingDateGreaterThanEqual(Integer eventId, LocalDate meetingDate);
}
