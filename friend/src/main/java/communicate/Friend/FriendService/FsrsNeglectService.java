package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Nightly chronic-neglect pass — ported from OO's BankruptcyService, minus
 * its mass-bankruptcy threshold-declare pass 2. That pass exists in OO to
 * handle hundreds of overdue flashcards piling up at once; Communicator
 * pools across dozens of friends (design doc premises 5/6), so every
 * overdue friend is handled individually via the same chronic-neglect logic
 * OO's pass 1 uses, with no separate "declare bankruptcy" threshold.
 *
 * A friend overdue by more than {@link #CHRONIC_NEGLECT_DAYS} gets their
 * FSRS state individually lapsed via FsrsService.forget() and rescheduled,
 * instead of drifting forgotten indefinitely with a stale due date.
 * Rescheduling spreads lapsed friends across the new interval window
 * (least-loaded day, same as OO) so a lapse sweep doesn't dump everyone onto
 * the same due date.
 *
 * Deliberately NO bandit reward here, and pendingBanditArm/pendingBanditBucket
 * are left untouched — a neglect lapse is exogenous (the user didn't reach
 * out), not evidence the interval was wrong; feeding it to the bandit would
 * punish good long arms for the user's absence. Same exclusion as OO's
 * BankruptcyService / this port's BanditService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FsrsNeglectService {

    /**
     * Days overdue before a friend's FSRS state gets lapsed. Starting guess
     * matching OO's BankruptcyService default (chronicNeglectDays = 7); TBD,
     * retune with data.
     */
    private static final int CHRONIC_NEGLECT_DAYS = 7;

    private final FriendRepository friendRepository;
    private final FsrsService fsrs;
    private final RoleProperties roleProperties;
    private final LeechService leechService;
    private final Random random = new Random();

    @Transactional
    public int applyNightlyLapse() {
        LocalDate today = LocalDate.now();
        Map<LocalDate, Integer> dayLoad = new HashMap<>();
        int lapsedCount = 0;

        for (Friend friend : friendRepository.findAll()) {
            // No FSRS state yet (never reviewed, or cold-start pending) —
            // nothing to lapse.
            if (friend.getFsrsStability() == null || friend.getFsrsDifficulty() == null
                    || friend.getPlannedSpeakingTime() == null) {
                continue;
            }
            long daysOverdue = ChronoUnit.DAYS.between(friend.getPlannedSpeakingTime(), today);
            if (daysOverdue <= CHRONIC_NEGLECT_DAYS) continue;

            try {
                lapseAndReschedule(friend, today, dayLoad);
                lapsedCount++;
            } catch (Exception e) {
                log.warn("[FSRS neglect] Failed to lapse friend {}", friend.getId(), e);
            }
        }

        if (lapsedCount > 0) {
            log.info("[FSRS neglect] Lapsed {} chronically overdue friend(s).", lapsedCount);
        }
        return lapsedCount;
    }

    private void lapseAndReschedule(Friend friend, LocalDate today, Map<LocalDate, Integer> dayLoad) {
        double elapsedDays = friend.getLastInteractionDate() == null
            ? 0
            : Math.max(0, ChronoUnit.DAYS.between(friend.getLastInteractionDate(), today));

        FsrsService.FsrsState lapsed = fsrs.forget(
            new FsrsService.FsrsState(friend.getFsrsStability(), friend.getFsrsDifficulty()), elapsedDays);

        double desiredRetention = roleProperties.getDesiredRetention(friend.getRole());
        int newIntervalDays = fsrs.intervalDays(lapsed.stability(), desiredRetention);
        LocalDate newDue = leastLoadedDate(today, newIntervalDays, dayLoad);

        friend.setFsrsStability(lapsed.stability());
        friend.setFsrsDifficulty(lapsed.difficulty());
        friend.setLastInteractionDate(today);
        friend.setPlannedSpeakingTime(newDue);
        // A neglect lapse only fires because the predicted due date already
        // passed unmet — always a miss for leech-flagging purposes.
        leechService.recordMiss(friend);
        friendRepository.save(friend);
    }

    /** Pick the least-loaded day within [today+1, today+interval]; ties broken randomly. */
    private LocalDate leastLoadedDate(LocalDate today, int interval, Map<LocalDate, Integer> dayLoad) {
        int minLoad = Integer.MAX_VALUE;
        List<LocalDate> candidates = new ArrayList<>();
        for (int d = 1; d <= Math.max(1, interval); d++) {
            LocalDate candidate = today.plusDays(d);
            int load = dayLoad.getOrDefault(candidate, 0);
            if (load < minLoad) {
                minLoad = load;
                candidates.clear();
                candidates.add(candidate);
            } else if (load == minLoad) {
                candidates.add(candidate);
            }
        }
        LocalDate chosen = candidates.get(random.nextInt(candidates.size()));
        dayLoad.merge(chosen, 1, Integer::sum);
        return chosen;
    }
}
