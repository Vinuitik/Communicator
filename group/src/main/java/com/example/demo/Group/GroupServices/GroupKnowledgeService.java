package com.example.demo.Group.GroupServices;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GroupKnowledgeService {

    private final GroupKnowledgeRepository groupKnowledgeRepository;
    private final SocialGroupRepository socialGroupRepository;

    @Transactional
    public List<GroupKnowledge> addKnowledgeToGroup(Integer groupId, List<GroupKnowledge> knowledgeList) {
        Optional<SocialGroup> groupOpt = socialGroupRepository.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Group not found with id: " + groupId);
        }

        SocialGroup group = groupOpt.get();
        
        for (GroupKnowledge knowledge : knowledgeList) {
            knowledge.setGroup(group);
            knowledge.setDate(LocalDate.now());
            knowledge.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
            knowledge.setInterval(1); // Default interval
        }
        
        return groupKnowledgeRepository.saveAll(knowledgeList);
    }

    @Transactional
    public GroupKnowledge addSingleKnowledgeToGroup(Integer groupId, GroupKnowledge knowledge) {
        Optional<SocialGroup> groupOpt = socialGroupRepository.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Group not found with id: " + groupId);
        }

        SocialGroup group = groupOpt.get();
        knowledge.setGroup(group);
        knowledge.setDate(LocalDate.now());
        knowledge.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
        knowledge.setInterval(1); // Default interval
        
        return groupKnowledgeRepository.save(knowledge);
    }

    public Page<GroupKnowledge> getGroupKnowledgePage(Integer groupId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
        return groupKnowledgeRepository.findByGroupId(groupId, pageable);
    }

    public List<GroupKnowledge> getAllGroupKnowledge(Integer groupId) {
        return groupKnowledgeRepository.findByGroupIdOrderByDateDesc(groupId);
    }

    @Transactional
    public GroupKnowledge updateKnowledge(Integer knowledgeId, GroupKnowledge updatedKnowledge) {
        Optional<GroupKnowledge> existingKnowledgeOpt = groupKnowledgeRepository.findById(knowledgeId);
        if (existingKnowledgeOpt.isEmpty()) {
            throw new RuntimeException("Knowledge not found with id: " + knowledgeId);
        }

        GroupKnowledge existingKnowledge = existingKnowledgeOpt.get();
        existingKnowledge.setText(updatedKnowledge.getText());
        existingKnowledge.setPriority(updatedKnowledge.getPriority());
        
        return groupKnowledgeRepository.save(existingKnowledge);
    }

    @Transactional
    public boolean deleteKnowledge(Integer knowledgeId) {
        if (groupKnowledgeRepository.existsById(knowledgeId)) {
            groupKnowledgeRepository.deleteById(knowledgeId);
            return true;
        }
        return false;
    }

    public Optional<GroupKnowledge> getKnowledgeById(Integer knowledgeId) {
        return groupKnowledgeRepository.findById(knowledgeId);
    }

    public long getKnowledgeCountForGroup(Integer groupId) {
        return groupKnowledgeRepository.countByGroupId(groupId);
    }
}
