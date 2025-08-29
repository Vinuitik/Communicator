package communicate.Friend.FriendRepositories;

import communicate.Friend.FriendEntities.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    // Custom queries if needed
}
