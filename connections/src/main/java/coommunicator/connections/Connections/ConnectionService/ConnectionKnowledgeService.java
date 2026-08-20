package coommunicator.connections.Connections.ConnectionService;

import java.time.LocalDate;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
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
    private final ApplicationEventPublisher eventPublisher;

    @Override
    protected JpaRepository<ConnectionsKnowledge, Integer> repository() {
        return knowledgeRepository;
    }

    // Same choke-point pattern as FriendKnowledgeService — see its comment. addKnowledge
    // funnels through saveAll; the controller's updateKnowledge calls the inherited
    // update(id, changes) directly (no per-service wrapper method existed for it here).
    @Override
    public ConnectionsKnowledge save(ConnectionsKnowledge item) {
        ConnectionsKnowledge saved = super.save(item);
        publishChunkTrigger(saved);
        return saved;
    }

    @Override
    public List<ConnectionsKnowledge> saveAll(List<ConnectionsKnowledge> items) {
        List<ConnectionsKnowledge> saved = super.saveAll(items);
        saved.forEach(this::publishChunkTrigger);
        return saved;
    }

    @Override
    public ConnectionsKnowledge update(Integer id, ConnectionsKnowledge changes) {
        ConnectionsKnowledge saved = super.update(id, changes);
        publishChunkTrigger(saved);
        return saved;
    }

    private void publishChunkTrigger(ConnectionsKnowledge knowledge) {
        ConnectionId id = knowledge.getConnection() != null ? knowledge.getConnection().getId() : null;
        Long friend1Id = id != null ? id.getFriend1Id() : null;
        Long friend2Id = id != null ? id.getFriend2Id() : null;
        eventPublisher.publishEvent(new KnowledgeChunkTriggerEvent(
                knowledge.getId(), "CONNECTION", null, null, friend1Id, friend2Id, knowledge.getText()));
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
