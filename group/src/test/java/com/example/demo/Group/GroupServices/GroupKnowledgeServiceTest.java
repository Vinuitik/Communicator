package com.example.demo.Group.GroupServices;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.context.ApplicationEventPublisher;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mirrors FriendKnowledgeServiceTest — confirms the eager chunk-trigger fires for
 * Group knowledge adds/updates, tagged source_type=GROUP with group_id populated
 * (not friend_id/connection ids).
 */
@ExtendWith(MockitoExtension.class)
class GroupKnowledgeServiceTest {

    @Mock GroupKnowledgeRepository groupKnowledgeRepository;
    @Mock SocialGroupRepository socialGroupRepository;
    @Mock ApplicationEventPublisher eventPublisher;

    private GroupKnowledgeService newService() {
        return new GroupKnowledgeService(groupKnowledgeRepository, socialGroupRepository, eventPublisher);
    }

    @Test
    void addKnowledgeToGroup_publishesGroupChunkTriggerEventPerItem() {
        GroupKnowledgeService service = newService();
        SocialGroup group = new SocialGroup();
        group.setId(4);
        when(socialGroupRepository.findById(4)).thenReturn(Optional.of(group));

        GroupKnowledge k1 = new GroupKnowledge();
        k1.setId(10);
        k1.setText("plans a hiking trip every summer");
        GroupKnowledge k2 = new GroupKnowledge();
        k2.setId(11);
        k2.setText("meets biweekly");
        List<GroupKnowledge> items = List.of(k1, k2);
        when(groupKnowledgeRepository.saveAll(items)).thenReturn(items);

        service.addKnowledgeToGroup(4, items);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher, times(2)).publishEvent(captor.capture());
        KnowledgeChunkTriggerEvent event = captor.getAllValues().get(0);
        assertThat(event.sourceType()).isEqualTo("GROUP");
        assertThat(event.groupId()).isEqualTo(4);
        assertThat(event.friendId()).isNull();
        assertThat(event.connectionFriend1Id()).isNull();
    }

    @Test
    void updateKnowledge_publishesGroupChunkTriggerEvent() {
        GroupKnowledgeService service = newService();
        GroupKnowledge existing = new GroupKnowledge();
        existing.setId(20);
        SocialGroup group = new SocialGroup();
        group.setId(6);
        existing.setGroup(group);
        existing.setText("old");
        existing.setPriority(3L);

        GroupKnowledge changes = new GroupKnowledge();
        changes.setText("updated text");
        changes.setPriority(4L);

        when(groupKnowledgeRepository.findById(20)).thenReturn(Optional.of(existing));
        when(groupKnowledgeRepository.save(existing)).thenReturn(existing);

        service.updateKnowledge(20, changes);

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().text()).isEqualTo("updated text");
        assertThat(captor.getValue().groupId()).isEqualTo(6);
        assertThat(captor.getValue().sourceType()).isEqualTo("GROUP");
    }
}
