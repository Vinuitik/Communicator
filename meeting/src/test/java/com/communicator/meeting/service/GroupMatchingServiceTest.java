package com.communicator.meeting.service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.communicator.meeting.dtos.GroupMatchDTO;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.GroupMemberService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GroupMatchingServiceTest {

    @Mock SocialGroupRepository groupRepository;
    @Mock GroupMemberService groupMemberService;

    private GroupMatchingService service;

    private GroupMatchingService newService() {
        return new GroupMatchingService(groupRepository, groupMemberService);
    }

    private Friend friend(int id) {
        Friend f = new Friend();
        f.setId(id);
        return f;
    }

    private SocialGroup group(int id, String name) {
        return SocialGroup.builder().id(id).name(name).build();
    }

    @Test
    void exactMatch_scoresOneAndWins() {
        service = newService();
        SocialGroup exact = group(1, "Poker Night");
        SocialGroup loose = group(2, "College Friends");
        when(groupRepository.findAll()).thenReturn(List.of(exact, loose));
        when(groupMemberService.getFriendsByGroupId(1)).thenReturn(List.of(friend(10), friend(11)));
        when(groupMemberService.getFriendsByGroupId(2)).thenReturn(List.of(friend(10), friend(11), friend(99)));

        Optional<GroupMatchDTO> best = service.findBestMatch(Set.of(10, 11));

        assertThat(best).isPresent();
        assertThat(best.get().groupId()).isEqualTo(1);
        assertThat(best.get().score()).isEqualTo(1.0);
    }

    @Test
    void looseSupersetGroup_scoresLowAndIsExcludedBelowThreshold() {
        service = newService();
        SocialGroup huge = group(1, "Everyone I know");
        when(groupRepository.findAll()).thenReturn(List.of(huge));
        // 3 attendees inside a 20-person group -> Jaccard well under 0.5
        List<Friend> roster = new java.util.ArrayList<>(List.of(friend(10), friend(11), friend(12)));
        for (int i = 20; i < 37; i++) roster.add(friend(i));
        when(groupMemberService.getFriendsByGroupId(1)).thenReturn(roster);

        Optional<GroupMatchDTO> best = service.findBestMatch(Set.of(10, 11, 12));

        assertThat(best).isEmpty();
    }

    @Test
    void looseSupersetScoresLowerThanCloseSubset_specificityFallsOutOfJaccardAlone() {
        service = newService();
        SocialGroup close = group(1, "Close");
        SocialGroup loose = group(2, "Loose");
        when(groupRepository.findAll()).thenReturn(List.of(loose, close));
        when(groupMemberService.getFriendsByGroupId(1)).thenReturn(List.of(friend(10), friend(11), friend(12), friend(13)));
        when(groupMemberService.getFriendsByGroupId(2)).thenReturn(List.of(friend(10), friend(11), friend(12), friend(13), friend(14)));

        List<GroupMatchDTO> candidates = service.findCandidates(Set.of(10, 11, 12));

        // close: intersection=3, union=4 -> 0.75; loose: intersection=3, union=5 -> 0.6 — close wins on score
        // alone, no tie-break needed: a bigger group with more non-attending members is naturally penalized.
        assertThat(candidates.get(0).groupId()).isEqualTo(1);
    }

    @Test
    void genuineScoreTie_prefersSmallerGroup() {
        service = newService();
        SocialGroup small = group(1, "Small"); // shares 2 of 3 attendees + 1 extra -> J = 2/4 = 0.5, size 3
        SocialGroup big = group(2, "Big");     // shares all 3 attendees + 3 extras -> J = 3/6 = 0.5, size 6
        when(groupRepository.findAll()).thenReturn(List.of(big, small));
        when(groupMemberService.getFriendsByGroupId(1)).thenReturn(List.of(friend(10), friend(11), friend(99)));
        when(groupMemberService.getFriendsByGroupId(2))
            .thenReturn(List.of(friend(10), friend(11), friend(12), friend(97), friend(98), friend(99)));

        List<GroupMatchDTO> candidates = service.findCandidates(Set.of(10, 11, 12));

        assertThat(candidates.get(0).score()).isEqualTo(candidates.get(1).score());
        assertThat(candidates.get(0).groupId()).isEqualTo(1);
        assertThat(candidates.get(0).groupSize()).isLessThan(candidates.get(1).groupSize());
    }

    @Test
    void noGroupsAtAll_returnsEmpty() {
        service = newService();
        when(groupRepository.findAll()).thenReturn(List.of());

        assertThat(service.findBestMatch(Set.of(10, 11))).isEmpty();
    }
}
