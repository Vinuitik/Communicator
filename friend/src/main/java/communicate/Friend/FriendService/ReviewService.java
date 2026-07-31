package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.Friend;
import lombok.RequiredArgsConstructor;

/**
 * Glue: grade -> FSRS state update -> bandit arm -> next due date, plus the
 * delayed bandit reward for the PREVIOUS scheduling decision. Ported from
 * OO's ReviewService.grade() pattern, adapted from OO's separate
 * NoteReviewRepository/FsrsStateWriter to Communicator's single Friend
 * entity holding its own scheduling state directly (fsrsStability/
 * fsrsDifficulty/lastInteractionDate/pendingBanditArm/pendingBanditBucket —
 * see Friend.java), consistent with how average_* EMA state already lives
 * on Friend rather than a side table.
 *
 * Pure computation over the passed-in Friend, same contract as the fixed
 * ladder it replaces (FriendService.setMeetingTime()): mutates the friend's
 * in-memory scheduling fields and returns the new plannedSpeakingTime: the
 * caller is responsible for persisting it (wired in FriendController, design
 * doc Next Steps #6).
 *
 * The delayed bandit reward credits the EFFECTIVE arm — the multiplier
 * matching the interval the friend was ACTUALLY contacted at, not the one
 * intended — so early/late contact becomes free exploration data for the
 * bandit instead of noise. See BanditService.
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final FsrsService fsrs;
    private final BanditService bandit;
    private final GradeComputationService gradeComputation;
    private final RoleProperties roleProperties;

    public LocalDate reviewInteraction(Friend friend, double durationHours, String experience,
                                        Boolean inPerson, LocalDate interactionDate) {
        int grade = gradeComputation.computeGrade(durationHours, experience, inPerson);
        LocalDate lastInteractionDate = friend.getLastInteractionDate();

        // 1. Delayed reward for the scheduling decision behind THIS
        //    interaction, credited to the EFFECTIVE arm = the interval the
        //    friend was really contacted at (realised elapsed / the base
        //    FSRS interval at that time).
        if (lastInteractionDate != null
                && friend.getPendingBanditArm() != null
                && friend.getPendingBanditBucket() != null
                && friend.getPlannedSpeakingTime() != null) {
            boolean recalled = grade != FsrsService.GRADE_HARD;
            double scheduledDays = Math.max(1,
                ChronoUnit.DAYS.between(lastInteractionDate, friend.getPlannedSpeakingTime()));
            double baseInterval = scheduledDays / friend.getPendingBanditArm();
            double actualElapsed = Math.max(0, ChronoUnit.DAYS.between(lastInteractionDate, interactionDate));
            double rawEffective = actualElapsed / baseInterval;
            bandit.reward(friend.getPendingBanditBucket(), rawEffective, recalled);
        }

        // 2. Pure FSRS state update (the bandit never touches this).
        FsrsService.FsrsState state;
        if (friend.getFsrsStability() == null || friend.getFsrsDifficulty() == null) {
            state = fsrs.initialState(grade);
        } else {
            double elapsedDays = lastInteractionDate == null
                ? 0
                : Math.max(0, ChronoUnit.DAYS.between(lastInteractionDate, interactionDate));
            state = fsrs.review(
                new FsrsService.FsrsState(friend.getFsrsStability(), friend.getFsrsDifficulty()),
                grade, elapsedDays);
        }

        // 3. Bandit picks the multiplier for the NEXT interval (applied to
        //    the scheduled date only, never stored FSRS state).
        double desiredRetention = roleProperties.getDesiredRetention(friend.getRole());
        int baseIntervalDays = fsrs.intervalDays(state.stability(), desiredRetention);
        String bucket = bandit.bucket(state.difficulty(), state.stability());
        double arm = bandit.chooseArm(bucket);
        long scheduledDays = Math.max(1, Math.round(baseIntervalDays * arm));
        LocalDate due = interactionDate.plusDays(scheduledDays);

        friend.setFsrsStability(state.stability());
        friend.setFsrsDifficulty(state.difficulty());
        friend.setLastInteractionDate(interactionDate);
        friend.setPendingBanditArm(arm);
        friend.setPendingBanditBucket(bucket);

        return due;
    }
}
