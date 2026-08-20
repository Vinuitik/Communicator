package com.example.demo.Group.GroupServices;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.communicator.knowledgecore.service.AbstractFactService;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupKnowledgeService extends AbstractFactService<GroupKnowledge, Integer> {

    private final GroupKnowledgeRepository groupKnowledgeRepository;
    private final SocialGroupRepository socialGroupRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    protected JpaRepository<GroupKnowledge, Integer> repository() {
        return groupKnowledgeRepository;
    }

    // Same choke-point pattern as FriendKnowledgeService — see its comment. Every
    // add/update path here (addKnowledgeToGroup, addSingleKnowledgeToGroup,
    // updateKnowledge) funnels through save/saveAll/update.
    @Override
    public GroupKnowledge save(GroupKnowledge item) {
        GroupKnowledge saved = super.save(item);
        publishChunkTrigger(saved);
        return saved;
    }

    @Override
    public List<GroupKnowledge> saveAll(List<GroupKnowledge> items) {
        List<GroupKnowledge> saved = super.saveAll(items);
        saved.forEach(this::publishChunkTrigger);
        return saved;
    }

    @Override
    public GroupKnowledge update(Integer id, GroupKnowledge changes) {
        GroupKnowledge saved = super.update(id, changes);
        publishChunkTrigger(saved);
        return saved;
    }

    private void publishChunkTrigger(GroupKnowledge knowledge) {
        Integer groupId = knowledge.getGroup() != null ? knowledge.getGroup().getId() : null;
        eventPublisher.publishEvent(new KnowledgeChunkTriggerEvent(
                knowledge.getId(), "GROUP", null, groupId, null, null, knowledge.getText()));
    }

    @Transactional
    public List<GroupKnowledge> addKnowledgeToGroup(Integer groupId, List<GroupKnowledge> knowledgeList) {
        SocialGroup group = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));

        for (GroupKnowledge knowledge : knowledgeList) {
            knowledge.setGroup(group);
            knowledge.setDate(LocalDate.now());
        }

        return saveAll(knowledgeList);
    }

    @Transactional
    public GroupKnowledge addSingleKnowledgeToGroup(Integer groupId, GroupKnowledge knowledge) {
        SocialGroup group = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));

        knowledge.setGroup(group);
        knowledge.setDate(LocalDate.now());

        return save(knowledge);
    }

    @Transactional
    public Page<GroupKnowledge> getGroupKnowledgePage(Integer groupId, int page, int size) {
        return groupKnowledgeRepository.findByGroupId(groupId, priorityPage(page, size));
    }

    @Transactional
    public List<GroupKnowledge> getAllGroupKnowledge(Integer groupId) {
        return groupKnowledgeRepository.findByGroupIdOrderByDateDesc(groupId);
    }

    @Transactional
    public GroupKnowledge updateKnowledge(Integer knowledgeId, GroupKnowledge updatedKnowledge) {
        return update(knowledgeId, updatedKnowledge);
    }

    @Transactional
    public boolean deleteKnowledge(Integer knowledgeId) {
        return deleteById(knowledgeId);
    }

    public Optional<GroupKnowledge> getKnowledgeById(Integer knowledgeId) {
        return findById(knowledgeId);
    }

    public long getKnowledgeCountForGroup(Integer groupId) {
        return groupKnowledgeRepository.countByGroupId(groupId);
    }

    public Map<Integer, Long> getKnowledgeCountsForGroups(List<Integer> groupIds) {
        return groupIds.stream()
                .collect(Collectors.toMap(
                    groupId -> groupId,
                    this::getKnowledgeCountForGroup
                ));
    }
}
