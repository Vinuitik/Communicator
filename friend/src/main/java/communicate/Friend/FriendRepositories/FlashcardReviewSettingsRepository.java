package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.FlashcardReviewSettings;

@Repository
public interface FlashcardReviewSettingsRepository extends JpaRepository<FlashcardReviewSettings, Integer> {
}
