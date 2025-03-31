package communicate.Connections.ConnectionsRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Connections.ConnectionsEntities.ConnectionPermission;

@Repository
public interface ConnectionPermissionRepository extends JpaRepository<ConnectionPermission, Integer> {

}
