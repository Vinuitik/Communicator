package coommunicator.connections.Connections.ConnectionsRepositories;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionPermission;

@Repository
public interface ConnectionPermissionRepository extends JpaRepository<ConnectionPermission, Integer> {

    @Query("SELECT p FROM ConnectionPermission p WHERE p.connection.id = :connectionId")
    List<ConnectionPermission> findByConnectionId(@Param("connectionId") ConnectionId connectionId);

    @Query("SELECT p FROM ConnectionPermission p WHERE p.connection.id = :connectionId")
    Page<ConnectionPermission> findByConnectionId(@Param("connectionId") ConnectionId connectionId, Pageable pageable);

    @Query("SELECT COUNT(p) FROM ConnectionPermission p WHERE p.connection.id = :connectionId")
    long countByConnectionId(@Param("connectionId") ConnectionId connectionId);
}
