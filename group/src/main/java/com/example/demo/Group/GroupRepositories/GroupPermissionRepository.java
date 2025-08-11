package com.example.demo.Group.GroupRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.demo.Group.GroupEntities.GroupPermission;
@Repository
public interface GroupPermissionRepository extends JpaRepository<GroupPermission, Integer> {
    
    long countByGroupId(Integer groupId);
}
