package communicate.Group.GroupRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Group.GroupEntities.GroupPermission;
@Repository
public interface GroupPermissionRepository extends JpaRepository<GroupPermission, Integer> {

}
