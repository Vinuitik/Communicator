package communicate.Friend.FriendRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.Videos;

@Repository
public interface VideosRepository extends JpaRepository<Videos, Integer>{

}
