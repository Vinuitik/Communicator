package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Social;

import java.util.List;

@Repository
public interface SocialRepository extends JpaRepository<Social, Integer> {
    
    /**
     * Find all social media links for a specific friend
     * @param friendId the ID of the friend
     * @return list of social media links
     */
    @Query("SELECT s FROM Social s WHERE s.friend.id = :friendId ORDER BY s.platform ASC")
    List<Social> findByFriendIdOrderByPlatform(@Param("friendId") Integer friendId);
    
    /**
     * Find social media links by friend ID and platform
     * @param friendId the ID of the friend
     * @param platform the platform name
     * @return list of social media links for the specific platform
     */
    @Query("SELECT s FROM Social s WHERE s.friend.id = :friendId AND s.platform = :platform")
    List<Social> findByFriendIdAndPlatform(@Param("friendId") Integer friendId, @Param("platform") String platform);
}
