package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Caps flashcard reviews per day by cascading overflow forward — ported
 * mechanism (not the exact numbers) from ObsidianOptimizer's
 * chrono/SpreadService.java, adapted from per-file frontmatter rewrites to
 * FriendKnowledgeReview.dueDate updates. Pools across EVERY starred friend
 * combined (design doc — one global daily cap, not per-friend), and never
 * touches FSRS memory state (stability/difficulty), only dueDate — same
 * Option-A separation OO's version documents. On an overloaded day the
 * HARDEST rows (highest fsrsDifficulty) stay put; the easiest spill to the
 * next day. A never-reviewed row (null difficulty) sorts as mid-difficulty
 * (5.0 of the 1-10 scale) — neither protected nor sacrificed first.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FlashcardSpreadService {

    private static final double UNREVIEWED_DIFFICULTY = 5.0;

    private final FriendKnowledgeReviewRepository reviewRepository;

    public record SpreadResult(int total, int moved) {}

    @Transactional
    public SpreadResult run(int maxDailyReviews) {
        LocalDate today = LocalDate.now();
        List<FriendKnowledgeReview> rows = reviewRepository.findByFriend_FlashcardsEnabledTrue();
        if (rows.isEmpty()) {
            return new SpreadResult(0, 0);
        }

        TreeMap<Integer, List<FriendKnowledgeReview>> byDay = new TreeMap<>();
        Map<FriendKnowledgeReview, LocalDate> originalDue = new java.util.HashMap<>();
        for (FriendKnowledgeReview row : rows) {
            int delta = (int) ChronoUnit.DAYS.between(today, row.getDueDate());
            byDay.computeIfAbsent(delta, k -> new ArrayList<>()).add(row);
            originalDue.put(row, row.getDueDate());
        }

        int total = rows.size();

        int maxDay = byDay.lastKey();
        for (int delta = byDay.firstKey(); delta <= maxDay; delta++) {
            List<FriendKnowledgeReview> dayRows = byDay.get(delta);
            if (dayRows == null || dayRows.size() <= maxDailyReviews) continue;
            // Hardest first -> the top maxDailyReviews stay; the easiest overflow.
            dayRows.sort(Comparator.comparingDouble(
                (FriendKnowledgeReview r) -> r.getFsrsDifficulty() != null ? r.getFsrsDifficulty() : UNREVIEWED_DIFFICULTY).reversed());
            List<FriendKnowledgeReview> overflow = new ArrayList<>(dayRows.subList(maxDailyReviews, dayRows.size()));
            dayRows.subList(maxDailyReviews, dayRows.size()).clear();
            byDay.computeIfAbsent(delta + 1, k -> new ArrayList<>()).addAll(overflow);
            maxDay = byDay.lastKey();
        }

        int moved = 0;
        List<FriendKnowledgeReview> toSave = new ArrayList<>();
        for (Map.Entry<Integer, List<FriendKnowledgeReview>> entry : byDay.entrySet()) {
            LocalDate assignedDate = today.plusDays(entry.getKey());
            for (FriendKnowledgeReview row : entry.getValue()) {
                if (assignedDate.equals(originalDue.get(row))) continue;
                row.setDueDate(assignedDate);
                toSave.add(row);
                moved++;
            }
        }
        if (!toSave.isEmpty()) {
            reviewRepository.saveAll(toSave);
        }

        log.info("[flashcard spread] {} row(s) across {} day(s), shifted {} to enforce max {}/day.",
            total, byDay.size(), moved, maxDailyReviews);
        return new SpreadResult(total, moved);
    }
}
