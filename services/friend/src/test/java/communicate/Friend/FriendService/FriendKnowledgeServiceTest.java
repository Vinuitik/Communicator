package communicate.Friend.FriendService;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.context.ApplicationEventPublisher;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Confirms the eager chunk-trigger fires (a KnowledgeChunkTriggerEvent is published)
 * after save/saveAll/update, and — the resilience requirement from the feature spec —
 * that publishing the event never touches the network directly, so a downed/failing
 * ai_agent can't fail the knowledge save. The actual HTTP dispatch lives in
 * knowledge-core's KnowledgeChunkTriggerClient/Listener (AFTER_COMMIT), which is
 * covered separately in KnowledgeChunkTriggerClientTest — this test only needs to
 * prove the publish side works, since ApplicationEventPublisher.publishEvent is
 * itself synchronous/in-memory and can't throw for network reasons.
 */
@ExtendWith(MockitoExtension.class)
class FriendKnowledgeServiceTest {

    @Mock FriendKnowledgeRepository knowledgeRepository;
    @Mock ApplicationEventPublisher eventPublisher;

    private FriendKnowledgeService newService() {
        return new FriendKnowledgeService(knowledgeRepository, eventPublisher);
    }

    @Test
    void insertKnowledge_publishesFriendChunkTriggerEvent() {
        FriendKnowledgeService service = newService();
        FriendKnowledge knowledge = new FriendKnowledge();
        knowledge.setId(101);
        knowledge.setText("Loves hiking in Colorado");
        when(knowledgeRepository.save(any(FriendKnowledge.class))).thenReturn(knowledge);

        service.insertKnowledge(knowledge, 7);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        KnowledgeChunkTriggerEvent event = captor.getValue();
        assertThat(event.knowledgeId()).isEqualTo(101);
        assertThat(event.sourceType()).isEqualTo("FRIEND");
        assertThat(event.friendId()).isEqualTo(7);
        assertThat(event.groupId()).isNull();
        assertThat(event.connectionFriend1Id()).isNull();
        assertThat(event.text()).isEqualTo("Loves hiking in Colorado");
    }

    @Test
    void saveAllTwoArgOverload_publishesEventPerItem() {
        FriendKnowledgeService service = newService();
        FriendKnowledge k1 = new FriendKnowledge();
        k1.setId(1);
        k1.setText("first");
        FriendKnowledge k2 = new FriendKnowledge();
        k2.setId(2);
        k2.setText("second");
        List<FriendKnowledge> items = List.of(k1, k2);
        when(knowledgeRepository.saveAll(items)).thenReturn(items);

        service.saveAll(items, 9);

        verify(eventPublisher, times(2)).publishEvent(any(KnowledgeChunkTriggerEvent.class));
    }

    @Test
    void update_publishesEventWithMergedEntity() {
        FriendKnowledgeService service = newService();
        FriendKnowledge existing = new FriendKnowledge();
        existing.setId(55);
        Friend friend = new Friend();
        friend.setId(3);
        existing.setFriend(friend);
        existing.setText("old text");
        existing.setPriority(5L);

        FriendKnowledge changes = new FriendKnowledge();
        changes.setText("new text");
        changes.setPriority(8L);

        when(knowledgeRepository.findById(55)).thenReturn(Optional.of(existing));
        when(knowledgeRepository.save(existing)).thenReturn(existing);

        service.update(55, changes);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().text()).isEqualTo("new text");
        assertThat(captor.getValue().friendId()).isEqualTo(3);
    }

    @Test
    void deleteKnowledgeById_doesNotPublishChunkTrigger() {
        FriendKnowledgeService service = newService();
        when(knowledgeRepository.existsById(1)).thenReturn(true);

        service.deleteKnowledgeById(1);

        verify(eventPublisher, never()).publishEvent(any());
    }
}
