package communicate.integration.repositories;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FriendKnowledgeRepositoryIT extends AbstractIntegrationTest {

    @Autowired FriendKnowledgeRepository knowledgeRepository;
    @Autowired FriendRepository          friendRepository;

    @Test
    void findByFriendId_returnsOnlyThatFriendsKnowledge() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        Friend bob   = friendRepository.save(buildFriend("Bob"));

        knowledgeRepository.save(buildKnowledge(alice, "Alice fact 1", 1L));
        knowledgeRepository.save(buildKnowledge(alice, "Alice fact 2", 2L));
        knowledgeRepository.save(buildKnowledge(bob,   "Bob fact",     1L));

        List<FriendKnowledge> aliceFacts = knowledgeRepository.findByFriendId(alice.getId());

        assertThat(aliceFacts).hasSize(2);
        assertThat(aliceFacts).allMatch(k -> k.getFriend().getId().equals(alice.getId()));
    }

    @Test
    void findAllSortedByPriority_returnsByPriorityAscending() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        knowledgeRepository.save(buildKnowledge(alice, "low priority",    10L));
        knowledgeRepository.save(buildKnowledge(alice, "high priority",    1L));
        knowledgeRepository.save(buildKnowledge(alice, "medium priority",  5L));

        List<FriendKnowledge> sorted = knowledgeRepository.findAllSortedByPriority();

        // priority ASC → 1, 5, 10
        assertThat(sorted).extracting(FriendKnowledge::getPriority)
                .isSortedAccordingTo(Long::compareTo);
    }

    @Test
    void findAllSortedByFriendIdAndPriority_returnsByPriorityDescending() {
        Friend alice = friendRepository.save(buildFriend("Alice"));
        knowledgeRepository.save(buildKnowledge(alice, "low",    1L));
        knowledgeRepository.save(buildKnowledge(alice, "high",  10L));
        knowledgeRepository.save(buildKnowledge(alice, "mid",    5L));

        List<FriendKnowledge> sorted = knowledgeRepository
                .findAllSortedByFriendIdAndPriority(alice.getId());

        // priority DESC → 10, 5, 1
        List<Long> priorities = sorted.stream().map(FriendKnowledge::getPriority).toList();
        assertThat(priorities).first().isEqualTo(10L);
        assertThat(priorities).last().isEqualTo(1L);
    }

    @Test
    void findByFriendId_noKnowledge_returnsEmpty() {
        Friend alice = friendRepository.save(buildFriend("Alice"));

        List<FriendKnowledge> result = knowledgeRepository.findByFriendId(alice.getId());

        assertThat(result).isEmpty();
    }
}
