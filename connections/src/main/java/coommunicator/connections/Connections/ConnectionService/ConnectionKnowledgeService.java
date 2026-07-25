package coommunicator.connections.Connections.ConnectionService;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;

import com.communicator.knowledgecore.service.AbstractFactService;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionsKnowledgeRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConnectionKnowledgeService extends AbstractFactService<ConnectionsKnowledge, Integer> {

    private final ConnectionsKnowledgeRepository knowledgeRepository;
    private final ConnectionRepository connectionRepository;

    @Override
    protected JpaRepository<ConnectionsKnowledge, Integer> repository() {
        return knowledgeRepository;
    }

    private ConnectionId idFor(Long friendAId, Long friendBId) {
        return new ConnectionId(Math.min(friendAId, friendBId), Math.max(friendAId, friendBId));
    }

    @Transactional
    public List<ConnectionsKnowledge> addKnowledge(Long friendAId, Long friendBId, List<ConnectionsKnowledge> knowledgeList) {
        ConnectionId id = idFor(friendAId, friendBId);
        Connection connection = connectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Connection not found: " + id));

        for (ConnectionsKnowledge k : knowledgeList) {
            k.setConnection(connection);
            k.setDate(LocalDate.now());
            k.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
            k.setInterval(1); // Default interval
        }
        return saveAll(knowledgeList);
    }

    @Transactional
    public List<ConnectionsKnowledge> getAllKnowledge(Long friendAId, Long friendBId) {
        return knowledgeRepository.findByConnectionId(idFor(friendAId, friendBId));
    }

    @Transactional
    public Page<ConnectionsKnowledge> getKnowledgePage(Long friendAId, Long friendBId, int page, int size) {
        return knowledgeRepository.findByConnectionId(idFor(friendAId, friendBId), priorityPage(page, size));
    }

    public long getKnowledgeCount(Long friendAId, Long friendBId) {
        return knowledgeRepository.countByConnectionId(idFor(friendAId, friendBId));
    }
}
