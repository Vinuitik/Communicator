package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.FriendPermission;

@Repository
public interface FriendPermissionRepository extends JpaRepository<FriendPermission, Integer> {

}
