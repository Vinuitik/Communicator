package coommunicator.connections.Connections.ConnectionsRepositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionType;

@Repository
public interface ConnectionRepository extends JpaRepository<Connection, ConnectionId> {

    @Query("SELECT c FROM Connection c WHERE c.id.friend1Id = :friendId OR c.id.friend2Id = :friendId")
    List<Connection> findByFriendId(@Param("friendId") Long friendId);

    List<Connection> findByType(ConnectionType type);
}
