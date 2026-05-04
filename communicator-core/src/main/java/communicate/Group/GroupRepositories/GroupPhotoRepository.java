package communicate.Group.GroupRepositories;

import communicate.Group.GroupEntities.GroupPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupPhotoRepository extends JpaRepository<GroupPhoto, Long> {
}

