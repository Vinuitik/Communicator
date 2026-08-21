package com.example.demo.Group.GroupRepositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.demo.Group.GroupEntities.GroupPermission;

import java.util.List;

@Repository
public interface GroupPermissionRepository extends JpaRepository<GroupPermission, Integer> {
    
    Page<GroupPermission> findByGroupId(Integer groupId, Pageable pageable);
    
    List<GroupPermission> findByGroupIdOrderByDateDesc(Integer groupId);
    
    long countByGroupId(Integer groupId);
}
