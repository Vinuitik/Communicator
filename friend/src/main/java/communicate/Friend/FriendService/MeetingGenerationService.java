package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendEvent;
import communicate.Friend.FriendEntities.Meeting;
import communicate.Friend.FriendRepositories.FriendEventRepository;
import communicate.Friend.FriendRepositories.MeetingRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class MeetingGenerationService {

    private final FriendEventRepository friendEventRepository;
    private final MeetingRepository meetingRepository;

    public List<Meeting> generateMissingNextMeetingsForAllFriends() {
        return generateMissingNextMeetings(friendEventRepository.findByActiveTrue(), LocalDate.now());
    }

    public List<Meeting> generateMissingNextMeetingsForFriend(Integer friendId) {
        return generateMissingNextMeetings(friendEventRepository.findByFriendIdAndActiveTrue(friendId), LocalDate.now());
    }

    public List<Meeting> generateMissingNextMeetings(List<FriendEvent> events, LocalDate referenceDate) {
        List<Meeting> createdMeetings = new ArrayList<>();

        for (FriendEvent event : events) {
            Meeting created = generateIfMissing(event, referenceDate);
            if (created != null) {
                createdMeetings.add(created);
            }
        }

        return createdMeetings;
    }

    private Meeting generateIfMissing(FriendEvent event, LocalDate referenceDate) {
        if (event == null || event.getId() == null || event.getFriend() == null) {
            return null;
        }

        if (Boolean.FALSE.equals(event.getActive())) {
            return null;
        }

        boolean hasFutureMeeting = meetingRepository.existsByEventIdAndMeetingDateGreaterThanEqual(event.getId(), referenceDate);
        if (hasFutureMeeting) {
            return null;
        }

        LocalDate nextOccurrence = calculateNextOccurrence(event, referenceDate);
        if (nextOccurrence == null) {
            return null;
        }

        Friend friend = event.getFriend();

        Meeting meeting = Meeting.builder()
                .meetingDate(nextOccurrence)
                .status("PLANNED")
                .source("EVENT_AUTO")
                .friend(friend)
                .event(event)
                .build();

        return meetingRepository.save(meeting);
    }

    private LocalDate calculateNextOccurrence(FriendEvent event, LocalDate referenceDate) {
        LocalDate baseDate = event.getBaseDate();
        Integer recurrenceDays = event.getRecurrenceDays();

        if (baseDate == null || recurrenceDays == null || recurrenceDays < 1) {
            return null;
        }

        LocalDate candidate = baseDate;

        boolean keepDate = Boolean.TRUE.equals(event.getKeepMeetingDate());
        if (keepDate && recurrenceDays % 365 == 0) {
            int recurrenceYears = recurrenceDays / 365;
            if (recurrenceYears < 1) {
                recurrenceYears = 1;
            }

            while (candidate.isBefore(referenceDate)) {
                candidate = candidate.plusYears(recurrenceYears);
            }
            return candidate;
        }

        while (candidate.isBefore(referenceDate)) {
            candidate = candidate.plusDays(recurrenceDays);
        }

        return candidate;
    }
}
