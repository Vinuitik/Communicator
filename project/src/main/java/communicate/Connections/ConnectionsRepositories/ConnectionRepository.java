package communicate.Connections.ConnectionsRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Connections.ConnectionsEntities.Connection;

@Repository
public interface ConnectionRepository extends JpaRepository<Connection, Integer> {

}
