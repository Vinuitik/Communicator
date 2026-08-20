package com.communicator.meeting.service;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.communicator.meeting.dtos.GroupMatchDTO;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.GroupMemberService;
import lombok.RequiredArgsConstructor;

/**
 * Auto-derives which existing SocialGroup (if any) a meeting's attendee set matches, so "Group"
 * meetings don't require manually picking a group — the match is the default, overridable.
 *
 * <p>Scoring: Jaccard similarity (intersection-over-union) between the meeting's attendee set and
 * each group's roster. Exact match scores 1.0 and always wins; a big group that loosely contains
 * the attendees among many others who aren't at this meeting scores low automatically (the union
 * grows with every non-attending member), so "prefer the tighter/more specific group" falls out
 * of the metric itself rather than needing a separate size penalty. Ties (equal score) break on
 * smaller group size. A residual genuine tie (same score AND same size) just returns the first —
 * callers wanting to disambiguate that case should list {@link #findCandidates} instead of taking
 * the single best match.
 */
@Service
@RequiredArgsConstructor
public class GroupMatchingService {

    /** Below this Jaccard score, treat as "no match" — default to an ad-hoc (unlinked) group meeting. */
    public static final double MIN_MATCH_THRESHOLD = 0.5;

    private final SocialGroupRepository groupRepository;
    private final GroupMemberService groupMemberService;

    /** Best match for this attendee set, or empty if nothing clears {@link #MIN_MATCH_THRESHOLD}. */
    public Optional<GroupMatchDTO> findBestMatch(Set<Integer> attendeeFriendIds) {
        return findCandidates(attendeeFriendIds).stream().findFirst();
    }

    /** All groups clearing the threshold, best match first (score desc, then size asc). */
    public List<GroupMatchDTO> findCandidates(Set<Integer> attendeeFriendIds) {
        if (attendeeFriendIds.isEmpty()) {
            return List.of();
        }
        return groupRepository.findAll().stream()
            .map(group -> score(attendeeFriendIds, group))
            .filter(m -> m.score() >= MIN_MATCH_THRESHOLD)
            .sorted(Comparator.comparingDouble(GroupMatchDTO::score).reversed()
                .thenComparingInt(GroupMatchDTO::groupSize))
            .toList();
    }

    private GroupMatchDTO score(Set<Integer> attendeeFriendIds, SocialGroup group) {
        Set<Integer> roster = new HashSet<>();
        for (Friend member : groupMemberService.getFriendsByGroupId(group.getId())) {
            roster.add(member.getId());
        }

        Set<Integer> intersection = new HashSet<>(attendeeFriendIds);
        intersection.retainAll(roster);
        Set<Integer> union = new HashSet<>(attendeeFriendIds);
        union.addAll(roster);

        double jaccard = union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
        return new GroupMatchDTO(group.getId(), group.getName(), jaccard, roster.size());
    }
}
