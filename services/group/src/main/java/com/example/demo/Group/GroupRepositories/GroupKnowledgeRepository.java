package com.example.demo.Group.GroupRepositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.demo.Group.GroupEntities.GroupKnowledge;

import java.util.List;

@Repository
public interface GroupKnowledgeRepository extends JpaRepository<GroupKnowledge, Integer> {
    
    Page<GroupKnowledge> findByGroupId(Integer groupId, Pageable pageable);
    
    List<GroupKnowledge> findByGroupIdOrderByDateDesc(Integer groupId);
    
    long countByGroupId(Integer groupId);
}
