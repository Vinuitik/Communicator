package communicate.Group.GroupRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Group.GroupEntities.SocialGroup;

@Repository
public interface SocialGroupRepository extends JpaRepository<SocialGroup, Integer> {

}
