package communicate.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Entities.Friend;
import communicate.Entities.Knowledge;
import jakarta.transaction.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface KnowledgeRepository extends JpaRepository<Knowledge, Integer> {
    public List<Knowledge> findByFriendId(Integer friendId);

    @Query("SELECT k FROM Knowledge k ORDER BY k.priority ASC")
    List<Knowledge> findAllSortedByPriority();

    @Query("SELECT k FROM Knowledge k WHERE k.friend.id = :friendId ORDER BY k.priority DESC")
    List<Knowledge> findAllSortedByFriendIdAndPriority(@Param("friendId") Integer friendId);

    Optional<Knowledge> findById(Integer id);
}