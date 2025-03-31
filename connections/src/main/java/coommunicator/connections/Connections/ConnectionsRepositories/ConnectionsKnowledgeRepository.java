package coommunicator.connections.Connections.ConnectionsRepositories;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;

@Repository
public interface ConnectionsKnowledgeRepository extends JpaRepository<ConnectionsKnowledge, Integer> {

}
