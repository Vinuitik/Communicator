package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
<<<<<<<< HEAD:friend/src/main/java/communicate/Friend/FriendRepositories/AnalyticsRepository.java
========
import communicate.Support.Knowledge;
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Friend/FriendRepositories/AnalyticsRepository.java

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AnalyticsRepository extends JpaRepository<Analytics, Integer> {
    List<Analytics> findByFriendIdAndDateBetween(Integer friendId, LocalDate leftDateBoundary, LocalDate rightDateBoundary);
}