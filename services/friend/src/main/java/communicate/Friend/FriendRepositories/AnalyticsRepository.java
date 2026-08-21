package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Analytics;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AnalyticsRepository extends JpaRepository<Analytics, Integer> {
    List<Analytics> findByFriendIdAndDateBetween(Integer friendId, LocalDate leftDateBoundary, LocalDate rightDateBoundary);
    
    /**
     * Batch query: Find which friends from the given list had interactions on a specific date
     * This avoids N+1 queries by using a single SQL query with IN clause
     */
    @Query("SELECT DISTINCT a.friend.id FROM Analytics a WHERE a.friend.id IN :friendIds AND a.date = :date")
    List<Integer> findFriendIdsWithInteractionsOnDate(@Param("friendIds") List<Integer> friendIds, @Param("date") LocalDate date);

    /**
     * Global bounds for duration minmax normalization (GradeComputationService).
     * Duration is unbounded/continuous, unlike the closed 3-value star scale,
     * so its normalization range must come from logged data rather than a
     * fixed constant.
     */
    @Query("SELECT MIN(a.hours) FROM Analytics a WHERE a.hours IS NOT NULL")
    Double findMinHours();

    @Query("SELECT MAX(a.hours) FROM Analytics a WHERE a.hours IS NOT NULL")
    Double findMaxHours();

    /** Full interaction history for one friend, oldest first — FsrsBackfillService's source data. */
    List<Analytics> findByFriendIdOrderByDateAsc(Integer friendId);
}