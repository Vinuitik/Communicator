package communicate.integration.services;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendEvent;
import communicate.Friend.FriendEntities.Meeting;
import communicate.Friend.FriendRepositories.FriendEventRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendRepositories.MeetingRepository;
import communicate.Friend.FriendService.MeetingGenerationService;
import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MeetingGenerationServiceIT extends AbstractIntegrationTest {

    @Autowired MeetingGenerationService  meetingGenerationService;
    @Autowired FriendRepository          friendRepository;
    @Autowired FriendEventRepository     friendEventRepository;
    @Autowired MeetingRepository         meetingRepository;

    // ── TC-I20: active event, no meeting → meeting generated ─────────────────

    @Test
    void activeEvent_noExistingMeeting_meetingCreated() {
        Friend alice  = friendRepository.save(buildFriend("Alice"));
        FriendEvent ev = friendEventRepository.save(buildEvent(alice, true));

        List<Meeting> created = meetingGenerationService.generateMissingNextMeetingsForFriend(alice.getId());

        assertThat(created).hasSize(1);
        assertThat(created.get(0).getMeetingDate()).isAfterOrEqualTo(LocalDate.now());
        assertThat(meetingRepository.findByFriendId(alice.getId())).hasSize(1);
    }

    // ── TC-I21: active event, meeting already exists → no duplicate ───────────

    @Test
    void activeEvent_futureMeetingAlreadyExists_noDuplicateCreated() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        FriendEvent ev = friendEventRepository.save(buildEvent(alice, true));

        // First call — creates the meeting
        meetingGenerationService.generateMissingNextMeetingsForFriend(alice.getId());
        // Second call — must not create another
        meetingGenerationService.generateMissingNextMeetingsForFriend(alice.getId());

        assertThat(meetingRepository.findByFriendId(alice.getId())).hasSize(1);
    }

    // ── TC-I22: inactive event → no meeting ──────────────────────────────────

    @Test
    void inactiveEvent_noMeetingGenerated() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        friendEventRepository.save(buildEvent(alice, false));

        List<Meeting> created = meetingGenerationService.generateMissingNextMeetingsForFriend(alice.getId());

        assertThat(created).isEmpty();
        assertThat(meetingRepository.findByFriendId(alice.getId())).isEmpty();
    }

    // ── TC-I23: friend with multiple active events → one meeting each ─────────

    @Test
    void multipleActiveEvents_meetingCreatedForEach() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        friendEventRepository.save(buildEvent(alice, true));
        friendEventRepository.save(buildEvent(alice, true));
        friendEventRepository.save(buildEvent(alice, true));

        List<Meeting> created = meetingGenerationService.generateMissingNextMeetingsForFriend(alice.getId());

        assertThat(created).hasSize(3);
    }

    // ── TC-I24: generateForAllFriends — processes all friends ─────────────────

    @Test
    void generateForAllFriends_createsMeetingsForEachFriendWithActiveEvent() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        Friend bob   = friendRepository.save(buildFriend("Bob"));
        Friend carol = friendRepository.save(buildFriend("Carol")); // no event

        friendEventRepository.save(buildEvent(alice, true));
        friendEventRepository.save(buildEvent(bob,   true));

        List<Meeting> created = meetingGenerationService.generateMissingNextMeetingsForAllFriends();

        // 2 meetings created (one per active friend); Carol has none
        assertThat(created).hasSize(2);
        assertThat(meetingRepository.findByFriendId(carol.getId())).isEmpty();
    }

    // ── TC-I25: no friends at all → no meetings, no exception ────────────────

    @Test
    void noFriendsInDatabase_returnsEmptyList() {
        List<Meeting> created = meetingGenerationService.generateMissingNextMeetingsForAllFriends();
        assertThat(created).isEmpty();
    }
}
