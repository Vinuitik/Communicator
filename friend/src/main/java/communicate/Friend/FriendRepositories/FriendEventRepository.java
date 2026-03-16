package communicate.Friend.FriendRepositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.FriendEvent;

@Repository
public interface FriendEventRepository extends JpaRepository<FriendEvent, Integer> {
    List<FriendEvent> findByFriendId(Integer friendId);

    java.util.Optional<FriendEvent> findByIdAndFriendId(Integer id, Integer friendId);

    List<FriendEvent> findByActiveTrue();

    List<FriendEvent> findByFriendIdAndActiveTrue(Integer friendId);
}
