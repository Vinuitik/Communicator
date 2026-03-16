package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.Meeting;
import communicate.Friend.FriendRepositories.MeetingRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class MeetingService {

    private final MeetingRepository meetingRepository;

    @Transactional(readOnly = true)
    public List<Meeting> getByFriendId(Integer friendId) {
        return meetingRepository.findByFriendId(friendId);
    }

    @Transactional(readOnly = true)
    public List<Meeting> getFutureByFriendId(Integer friendId, LocalDate fromDate) {
        return meetingRepository.findByFriendIdAndMeetingDateAfter(friendId, fromDate);
    }

    @Transactional(readOnly = true)
    public Optional<Meeting> getById(Integer meetingId) {
        return meetingRepository.findById(meetingId);
    }

    @Transactional(readOnly = true)
    public Optional<Meeting> getByIdAndFriendId(Integer meetingId, Integer friendId) {
        return meetingRepository.findByIdAndFriendId(meetingId, friendId);
    }

    @Transactional(readOnly = true)
    public List<Meeting> getUpcoming(LocalDate fromDate) {
        return meetingRepository.findByMeetingDateAfterOrderByMeetingDateAsc(fromDate);
    }

    public Meeting save(Meeting meeting) {
        return meetingRepository.save(meeting);
    }

    public void deleteById(Integer meetingId) {
        meetingRepository.deleteById(meetingId);
    }

    public Meeting updateMeeting(Integer meetingId, Meeting updateData) {
        Optional<Meeting> existingOpt = meetingRepository.findById(meetingId);
        if (existingOpt.isEmpty()) {
            return null;
        }

        Meeting existing = existingOpt.get();

        if (updateData.getMeetingDate() != null) {
            existing.setMeetingDate(updateData.getMeetingDate());
        }

        if (updateData.getStatus() != null) {
            existing.setStatus(updateData.getStatus());
        }

        if (updateData.getSource() != null) {
            existing.setSource(updateData.getSource());
        }

        if (updateData.getEvent() != null) {
            existing.setEvent(updateData.getEvent());
        }

        return meetingRepository.save(existing);
    }
}
