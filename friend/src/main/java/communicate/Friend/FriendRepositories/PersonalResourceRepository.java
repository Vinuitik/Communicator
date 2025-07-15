package communicate.Friend.FriendRepositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.PersonalResource;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface PersonalResourceRepository extends JpaRepository<PersonalResource, Integer> {
    
    // Find all resources for a specific friend
    List<PersonalResource> findByFriendId(Integer friendId);
    
    // Find resources by name (partial match)
    List<PersonalResource> findByResourceNameContainingIgnoreCase(String resourceName);
    
    // Find resources by MIME type
    List<PersonalResource> findByMimeType(String mimeType);
    
    // Find resources by friend and MIME type
    List<PersonalResource> findByFriendIdAndMimeType(Integer friendId, String mimeType);
    
    // Get resource metadata (without actual data) for efficiency
    @Query("SELECT new PersonalResource(pr.id, null, pr.resourceName, pr.mimeType, pr.friend) " +
           "FROM PersonalResource pr WHERE pr.friend.id = :friendId")
    List<PersonalResource> findResourceMetadataByFriendId(@Param("friendId") Integer friendId);
    
    // Count resources for a friend
    long countByFriendId(Integer friendId);
    
    // Check if resource exists by name for a friend
    boolean existsByFriendIdAndResourceName(Integer friendId, String resourceName);
    
    // Find by friend and resource name
    Optional<PersonalResource> findByFriendIdAndResourceName(Integer friendId, String resourceName);

    List<PersonalResource> findAllByFriend(Friend friend);

    Page<PersonalResource> findByFriendIdOrderByTimeBuiltDesc(Integer friendId, Pageable pageable);
}
