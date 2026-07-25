package coommunicator.connections.Connections.ConnectionService;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;

import com.communicator.knowledgecore.service.AbstractFactService;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionPermission;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionPermissionRepository;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConnectionPermissionService extends AbstractFactService<ConnectionPermission, Integer> {

    private final ConnectionPermissionRepository permissionRepository;
    private final ConnectionRepository connectionRepository;

    @Override
    protected JpaRepository<ConnectionPermission, Integer> repository() {
        return permissionRepository;
    }

    private ConnectionId idFor(Long friendAId, Long friendBId) {
        return new ConnectionId(Math.min(friendAId, friendBId), Math.max(friendAId, friendBId));
    }

    @Transactional
    public List<ConnectionPermission> addPermission(Long friendAId, Long friendBId, List<ConnectionPermission> permissionList) {
        ConnectionId id = idFor(friendAId, friendBId);
        Connection connection = connectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Connection not found: " + id));

        for (ConnectionPermission p : permissionList) {
            p.setConnection(connection);
            p.setDate(LocalDate.now());
            p.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
            p.setInterval(1); // Default interval
        }
        return saveAll(permissionList);
    }

    @Transactional
    public List<ConnectionPermission> getAllPermission(Long friendAId, Long friendBId) {
        return permissionRepository.findByConnectionId(idFor(friendAId, friendBId));
    }

    @Transactional
    public Page<ConnectionPermission> getPermissionPage(Long friendAId, Long friendBId, int page, int size) {
        return permissionRepository.findByConnectionId(idFor(friendAId, friendBId), priorityPage(page, size));
    }

    public long getPermissionCount(Long friendAId, Long friendBId) {
        return permissionRepository.countByConnectionId(idFor(friendAId, friendBId));
    }
}
