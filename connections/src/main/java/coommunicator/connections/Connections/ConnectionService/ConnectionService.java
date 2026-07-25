package coommunicator.connections.Connections.ConnectionService;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * A "connection" is a pairwise relationship link between two friends — same
 * knowledge/permission tracking as friend/group, but the owner is an
 * unordered pair of friend ids instead of a single one. friend1/friend2 are
 * always stored in (min, max) order (see idFor) so {A,B} and {B,A} resolve
 * to the same row — the DB unique constraint on (friend1_id, friend2_id)
 * only helps if callers agree on ordering.
 */
@Service
@RequiredArgsConstructor
public class ConnectionService {

    private final ConnectionRepository connectionRepository;

    private ConnectionId idFor(Long friendAId, Long friendBId) {
        return new ConnectionId(Math.min(friendAId, friendBId), Math.max(friendAId, friendBId));
    }

    public List<Connection> getAll() {
        return connectionRepository.findAll();
    }

    public List<Connection> getByFriendId(Long friendId) {
        return connectionRepository.findByFriendId(friendId);
    }

    public Optional<Connection> getById(Long friendAId, Long friendBId) {
        return connectionRepository.findById(idFor(friendAId, friendBId));
    }

    @Transactional
    public Connection create(Long friendAId, Long friendBId, String description) {
        if (friendAId.equals(friendBId)) {
            throw new IllegalArgumentException("A connection needs two different friends.");
        }
        ConnectionId id = idFor(friendAId, friendBId);
        if (connectionRepository.existsById(id)) {
            throw new IllegalStateException("This connection already exists.");
        }
        Connection connection = new Connection(friendAId, friendBId);
        connection.setDescription(description);
        return connectionRepository.save(connection);
    }

    @Transactional
    public boolean deleteById(Long friendAId, Long friendBId) {
        ConnectionId id = idFor(friendAId, friendBId);
        if (!connectionRepository.existsById(id)) {
            return false;
        }
        connectionRepository.deleteById(id);
        return true;
    }
}
