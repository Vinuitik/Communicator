package communicate.Friend.FriendRepositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.ConsumedWriteRequest;

@Repository
public interface ConsumedWriteRequestRepository extends JpaRepository<ConsumedWriteRequest, UUID> {
}
