package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import communicate.Friend.FriendEntities.FriendKnowledge;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendKnowledgeRepository extends JpaRepository<FriendKnowledge, Integer> {
    List<FriendKnowledge> findByFriendId(Integer friendId);

    @Query("SELECT k FROM FriendKnowledge k ORDER BY k.priority ASC")
    List<FriendKnowledge> findAllSortedByPriority();

    @Query("SELECT k FROM FriendKnowledge k WHERE k.friend.id = :friendId ORDER BY k.priority DESC")
    List<FriendKnowledge> findAllSortedByFriendIdAndPriority(@Param("friendId") Integer friendId);

    Optional<FriendKnowledge> findById(Integer id);

    Page<FriendKnowledge> findByFriendId(Integer friendId, Pageable pageable);
}