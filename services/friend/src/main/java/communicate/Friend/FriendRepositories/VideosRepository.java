package communicate.Friend.FriendRepositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.Videos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface VideosRepository extends JpaRepository<Videos, Integer>{
    // Find all videos for a specific friend
    List<Videos> findByFriendId(Integer friendId);
    
    // Find videos by name (partial match)
    List<Videos> findByVideoNameContainingIgnoreCase(String videoName);
    
    // Count videos for a friend
    long countByFriendId(Integer friendId);
    
    // Check if video exists by name for a friend
    boolean existsByFriendIdAndVideoName(Integer friendId, String videoName);
    
    // Find by friend and video name
    Optional<Videos> findByFriendIdAndVideoName(Integer friendId, String videoName);

    List<Videos> findAllByFriend(Friend friend);

    Page<Videos> findByFriendIdOrderByTimeBuiltDesc(Integer friendId, Pageable pageable);

    Optional<Videos> findByVideoNameAndFriend(String videoName, Friend friend);

    @Query(value = "SELECT * FROM videos WHERE friend_id = :friendId ORDER BY time_built DESC LIMIT :limit OFFSET :offset", 
           nativeQuery = true)
    List<Videos> findByFriendIdOrderByTimeBuiltDescWithLimitOffset(
        @Param("friendId") int friendId,
        @Param("offset") int offset,
        @Param("limit") int limit
    );
}
