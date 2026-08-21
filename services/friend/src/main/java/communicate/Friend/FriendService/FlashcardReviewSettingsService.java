package communicate.Friend.FriendService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.FlashcardReviewSettings;
import communicate.Friend.FriendRepositories.FlashcardReviewSettingsRepository;
import lombok.RequiredArgsConstructor;

/**
 * Reads/writes the single {@link FlashcardReviewSettings} row, seeding OO's
 * defaults (maxDailyReviews=30, chronicNeglectDays=7, bankruptcyLimit=200)
 * the first time it's read — no separate seed runner needed since there's
 * only ever one row.
 */
@Service
@RequiredArgsConstructor
public class FlashcardReviewSettingsService {

    private static final int DEFAULT_MAX_DAILY_REVIEWS = 30;
    private static final int DEFAULT_CHRONIC_NEGLECT_DAYS = 7;
    private static final int DEFAULT_BANKRUPTCY_LIMIT = 200;

    private final FlashcardReviewSettingsRepository repository;

    @Transactional
    public FlashcardReviewSettings get() {
        return repository.findById(FlashcardReviewSettings.SINGLETON_ID)
            .orElseGet(() -> repository.save(new FlashcardReviewSettings(
                FlashcardReviewSettings.SINGLETON_ID, DEFAULT_MAX_DAILY_REVIEWS, DEFAULT_CHRONIC_NEGLECT_DAYS, DEFAULT_BANKRUPTCY_LIMIT)));
    }

    @Transactional
    public FlashcardReviewSettings update(int maxDailyReviews, int chronicNeglectDays, int bankruptcyLimit) {
        FlashcardReviewSettings settings = get();
        settings.setMaxDailyReviews(maxDailyReviews);
        settings.setChronicNeglectDays(chronicNeglectDays);
        settings.setBankruptcyLimit(bankruptcyLimit);
        return repository.save(settings);
    }
}
