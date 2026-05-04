package communicate.Friend.FriendRepositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.Photos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface PhotosRepository extends JpaRepository<Photos, Integer> {
     // Find all photos for a specific friend
    List<Photos> findByFriendId(Integer friendId);
    
    // Find photos by name (partial match)
    List<Photos> findByPhotoNameContainingIgnoreCase(String photoName);
    
    List<Photos> findPhotoByFriendId(Integer friendId);
    
    // Count photos for a friend
    long countByFriendId(Integer friendId);
    
    // Check if photo exists by name for a friend
    boolean existsByFriendIdAndPhotoName(Integer friendId, String photoName);
    
    // Find by friend and photo name
    Optional<Photos> findByFriendIdAndPhotoName(Integer friendId, String photoName);

    List<Photos> findAllByFriend(Friend friend);

    Page<Photos> findByFriendIdOrderByTimeBuiltDesc(Integer friendId, Pageable pageable);

    Optional<Photos> findByPhotoNameAndFriend(String photoName, Friend friend);

    @Query(value = "SELECT * FROM photos WHERE friend_id = :friendId ORDER BY time_built DESC LIMIT :limit OFFSET :offset", 
           nativeQuery = true)
    List<Photos> findByFriendIdOrderByTimeBuiltDescWithLimitOffset(
        @Param("friendId") int friendId,
        @Param("offset") int offset,
        @Param("limit") int limit
    );
}
