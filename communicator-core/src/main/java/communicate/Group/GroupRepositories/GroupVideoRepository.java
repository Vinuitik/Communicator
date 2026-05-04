package communicate.Group.GroupRepositories;

import communicate.Group.GroupEntities.GroupVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupVideoRepository extends JpaRepository<GroupVideo, Long> {
}

