package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Social;

@Repository
public interface SocialRepository extends JpaRepository<Social, Integer> {

}
