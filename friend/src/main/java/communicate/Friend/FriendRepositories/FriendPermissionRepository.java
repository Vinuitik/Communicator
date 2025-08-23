package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import communicate.Friend.FriendEntities.FriendPermission;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendPermissionRepository extends JpaRepository<FriendPermission, Integer> {
    List<FriendPermission> findByFriendId(Integer friendId);

    @Query("SELECT p FROM FriendPermission p ORDER BY p.priority ASC")
    List<FriendPermission> findAllSortedByPriority();

    @Query("SELECT p FROM FriendPermission p WHERE p.friend.id = :friendId ORDER BY p.priority DESC")
    List<FriendPermission> findAllSortedByFriendIdAndPriority(@Param("friendId") Integer friendId);

    Optional<FriendPermission> findById(Integer id);

    Page<FriendPermission> findByFriendId(Integer friendId, Pageable pageable);
}
