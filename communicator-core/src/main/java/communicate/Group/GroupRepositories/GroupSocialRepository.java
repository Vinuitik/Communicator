package communicate.Group.GroupRepositories;

import communicate.Group.GroupEntities.GroupSocial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupSocialRepository extends JpaRepository<GroupSocial, Integer> {
}

