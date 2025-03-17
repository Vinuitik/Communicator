package communicate.Group.GroupRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Group.GroupEntities.GroupKnowledge;

@Repository
public interface GroupKnowledgeRepository extends JpaRepository<GroupKnowledge, Integer> {

}
