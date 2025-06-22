package communicate.Friend.FriendRepositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.Videos;

@Repository
public interface VideosRepository extends JpaRepository<Videos, Integer>{
    // Find all videos for a specific friend
    List<Videos> findByFriendId(Integer friendId);
    
    // Find videos by name (partial match)
    List<Videos> findByVideoNameContainingIgnoreCase(String videoName);
    
    // Get video metadata (without actual data) for efficiency
    @Query("SELECT new Videos(v.id, null, v.videoName, v.mimeType, v.friend) " +
           "FROM Videos v WHERE v.friend.id = :friendId")
    List<Videos> findVideoMetadataByFriendId(@Param("friendId") Integer friendId);
    
    // Count videos for a friend
    long countByFriendId(Integer friendId);
    
    // Check if video exists by name for a friend
    boolean existsByFriendIdAndVideoName(Integer friendId, String videoName);
    
    // Find by friend and video name
    Optional<Videos> findByFriendIdAndVideoName(Integer friendId, String videoName);

    List<Videos> findAllByFriend(Friend friend);
}
