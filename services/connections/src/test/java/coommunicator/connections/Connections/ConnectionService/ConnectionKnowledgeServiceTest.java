package coommunicator.connections.Connections.ConnectionService;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.context.ApplicationEventPublisher;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionsKnowledgeRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/**
 * Mirrors FriendKnowledgeServiceTest/GroupKnowledgeServiceTest — confirms the eager
 * chunk-trigger fires for Connection knowledge adds/updates, tagged
 * source_type=CONNECTION with both canonicalized (min/max) friend ids populated.
 */
@ExtendWith(MockitoExtension.class)
class ConnectionKnowledgeServiceTest {

    @Mock ConnectionsKnowledgeRepository knowledgeRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ApplicationEventPublisher eventPublisher;

    private ConnectionKnowledgeService newService() {
        return new ConnectionKnowledgeService(knowledgeRepository, connectionRepository, eventPublisher);
    }

    @Test
    void addKnowledge_publishesConnectionChunkTriggerEventWithCanonicalizedIds() {
        ConnectionKnowledgeService service = newService();
        ConnectionId id = new ConnectionId(2L, 9L);
        Connection connection = new Connection();
        connection.setId(id);
        when(connectionRepository.findById(id)).thenReturn(Optional.of(connection));

        ConnectionsKnowledge k = new ConnectionsKnowledge();
        k.setId(30);
        k.setText("always argue about politics");
        List<ConnectionsKnowledge> items = List.of(k);
        when(knowledgeRepository.saveAll(items)).thenReturn(items);

        // Pass friendAId/friendBId in reverse order — service canonicalizes internally.
        service.addKnowledge(9L, 2L, items);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        KnowledgeChunkTriggerEvent event = captor.getValue();
        assertThat(event.sourceType()).isEqualTo("CONNECTION");
        assertThat(event.connectionFriend1Id()).isEqualTo(2L);
        assertThat(event.connectionFriend2Id()).isEqualTo(9L);
        assertThat(event.friendId()).isNull();
        assertThat(event.groupId()).isNull();
    }

    @Test
    void update_publishesConnectionChunkTriggerEvent() {
        ConnectionKnowledgeService service = newService();
        ConnectionsKnowledge existing = new ConnectionsKnowledge();
        existing.setId(40);
        Connection connection = new Connection();
        connection.setId(new ConnectionId(1L, 5L));
        existing.setConnection(connection);
        existing.setText("old");
        existing.setPriority(2L);

        ConnectionsKnowledge changes = new ConnectionsKnowledge();
        changes.setText("new note");
        changes.setPriority(6L);

        when(knowledgeRepository.findById(40)).thenReturn(Optional.of(existing));
        when(knowledgeRepository.save(existing)).thenReturn(existing);

        service.update(40, changes);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().text()).isEqualTo("new note");
        assertThat(captor.getValue().connectionFriend1Id()).isEqualTo(1L);
        assertThat(captor.getValue().connectionFriend2Id()).isEqualTo(5L);
    }
}
