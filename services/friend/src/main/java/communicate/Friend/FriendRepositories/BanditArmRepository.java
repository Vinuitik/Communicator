package communicate.Friend.FriendRepositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.BanditArm;
import communicate.Friend.FriendEntities.BanditArmId;

@Repository
public interface BanditArmRepository extends JpaRepository<BanditArm, BanditArmId> {
    List<BanditArm> findByIdContextBucket(String contextBucket);
}
