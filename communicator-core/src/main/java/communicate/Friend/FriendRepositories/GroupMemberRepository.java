package communicate.Friend.FriendRepositories;

import communicate.Friend.FriendEntities.GroupMember;
import communicate.Friend.FriendEntities.Friend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    
    // Find all group members by friend ID
    List<GroupMember> findByFriend_Id(Integer friendId);
    
    // Find all group members by group ID
    List<GroupMember> findByGroupId(Integer groupId);
    
    // Find all friends in a specific group
    @Query("SELECT gm.friend FROM GroupMember gm WHERE gm.groupId = :groupId")
    List<Friend> findFriendsByGroupId(@Param("groupId") Integer groupId);
    
    // Find all group IDs for a specific friend
    @Query("SELECT gm.groupId FROM GroupMember gm WHERE gm.friend.id = :friendId")
    List<Integer> findGroupIdsByFriendId(@Param("friendId") Integer friendId);
}
