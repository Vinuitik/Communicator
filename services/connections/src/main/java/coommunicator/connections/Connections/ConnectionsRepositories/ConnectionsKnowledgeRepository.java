package coommunicator.connections.Connections.ConnectionsRepositories;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;

@Repository
public interface ConnectionsKnowledgeRepository extends JpaRepository<ConnectionsKnowledge, Integer> {

    @Query("SELECT k FROM ConnectionsKnowledge k WHERE k.connection.id = :connectionId")
    List<ConnectionsKnowledge> findByConnectionId(@Param("connectionId") ConnectionId connectionId);

    @Query("SELECT k FROM ConnectionsKnowledge k WHERE k.connection.id = :connectionId")
    Page<ConnectionsKnowledge> findByConnectionId(@Param("connectionId") ConnectionId connectionId, Pageable pageable);

    @Query("SELECT COUNT(k) FROM ConnectionsKnowledge k WHERE k.connection.id = :connectionId")
    long countByConnectionId(@Param("connectionId") ConnectionId connectionId);
}
