package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Photos;

@Repository
public interface PhotosRepository extends JpaRepository<Photos, Integer> {

}
