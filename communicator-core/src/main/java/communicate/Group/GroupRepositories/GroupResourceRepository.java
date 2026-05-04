package communicate.Group.GroupRepositories;

import communicate.Group.GroupEntities.GroupResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupResourceRepository extends JpaRepository<GroupResource, Long> {
}

