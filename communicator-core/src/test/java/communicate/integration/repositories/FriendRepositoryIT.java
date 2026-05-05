package communicate.integration.repositories;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class FriendRepositoryIT extends AbstractIntegrationTest {

    @Autowired FriendRepository friendRepository;

    @Test
    void save_andFindById_roundTrip() {
        Friend saved = friendRepository.save(buildFriend("Alice"));

        Optional<Friend> found = friendRepository.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Alice");
    }

    @Test
    void count_reflectsNumberOfSavedFriends() {
        long before = friendRepository.count();
        friendRepository.save(buildFriend("Bob"));
        friendRepository.save(buildFriend("Carol"));

        assertThat(friendRepository.count()).isEqualTo(before + 2);
    }

    @Test
    void findAll_paginated_returnsCorrectPage() {
        // Save 5 friends
        for (int i = 0; i < 5; i++) {
            friendRepository.save(buildFriend("Friend_" + i));
        }

        Page<Friend> page0 = friendRepository.findAll(PageRequest.of(0, 3));
        Page<Friend> page1 = friendRepository.findAll(PageRequest.of(1, 3));

        assertThat(page0.getContent()).hasSize(3);
        assertThat(page1.getContent()).hasSizeLessThanOrEqualTo(3);
        assertThat(page0.getTotalElements()).isGreaterThanOrEqualTo(5);
    }

    @Test
    void findAll_beyondLastPage_returnsEmptyPage() {
        friendRepository.save(buildFriend("Alice"));

        Page<Friend> page = friendRepository.findAll(PageRequest.of(999, 10));

        assertThat(page.getContent()).isEmpty();
    }

    @Test
    void saveWithAverages_averagesPersisted() {
        Friend friend = friendRepository.save(buildFriendWithAverages("Dave", 0.5, 0.3, 1.2));

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();

        assertThat(reloaded.getAverageFrequency()).isEqualTo(0.5);
        assertThat(reloaded.getAverageDuration()).isEqualTo(0.3);
        assertThat(reloaded.getAverageExcitement()).isEqualTo(1.2);
    }

    @Test
    void updateAverages_changesPersist() {
        Friend friend = friendRepository.save(buildFriendWithAverages("Eve", 1.0, 1.0, 1.0));

        friend.setAverageFrequency(0.5);
        friend.setAverageDuration(0.4);
        friend.setAverageExcitement(0.6);
        friendRepository.save(friend);

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        assertThat(reloaded.getAverageFrequency()).isEqualTo(0.5);
        assertThat(reloaded.getAverageDuration()).isEqualTo(0.4);
        assertThat(reloaded.getAverageExcitement()).isEqualTo(0.6);
    }
}
