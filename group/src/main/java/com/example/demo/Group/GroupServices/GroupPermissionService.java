package com.example.demo.Group.GroupServices;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;

import com.example.demo.Group.GroupEntities.GroupPermission;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupPermissionRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupPermissionService {

    private final GroupPermissionRepository groupPermissionRepository;
    private final SocialGroupRepository socialGroupRepository;

    @Transactional
    public List<GroupPermission> addPermissionToGroup(Integer groupId, List<GroupPermission> permissionList) {
        Optional<SocialGroup> groupOpt = socialGroupRepository.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Group not found with id: " + groupId);
        }

        SocialGroup group = groupOpt.get();
        
        for (GroupPermission permission : permissionList) {
            permission.setGroup(group);
            permission.setDate(LocalDate.now());
            permission.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
            permission.setInterval(1); // Default interval
        }
        
        return groupPermissionRepository.saveAll(permissionList);
    }

    @Transactional
    public GroupPermission addSinglePermissionToGroup(Integer groupId, GroupPermission permission) {
        Optional<SocialGroup> groupOpt = socialGroupRepository.findById(groupId);
        if (groupOpt.isEmpty()) {
            throw new RuntimeException("Group not found with id: " + groupId);
        }

        SocialGroup group = groupOpt.get();
        permission.setGroup(group);
        permission.setDate(LocalDate.now());
        permission.setReviewDate(LocalDate.now().plusDays(1)); // Default review date
        permission.setInterval(1); // Default interval
        
        return groupPermissionRepository.save(permission);
    }

    @Transactional
    public Page<GroupPermission> getGroupPermissionPage(Integer groupId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "priority"));
        return groupPermissionRepository.findByGroupId(groupId, pageable);
    }

    @Transactional
    public List<GroupPermission> getAllGroupPermission(Integer groupId) {
        return groupPermissionRepository.findByGroupIdOrderByDateDesc(groupId);
    }

    @Transactional
    public GroupPermission updatePermission(Integer permissionId, GroupPermission updatedPermission) {
        Optional<GroupPermission> existingPermissionOpt = groupPermissionRepository.findById(permissionId);
        if (existingPermissionOpt.isEmpty()) {
            throw new RuntimeException("Permission not found with id: " + permissionId);
        }

        GroupPermission existingPermission = existingPermissionOpt.get();
        existingPermission.setText(updatedPermission.getText());
        existingPermission.setPriority(updatedPermission.getPriority());
        
        return groupPermissionRepository.save(existingPermission);
    }

    @Transactional
    public boolean deletePermission(Integer permissionId) {
        if (groupPermissionRepository.existsById(permissionId)) {
            groupPermissionRepository.deleteById(permissionId);
            return true;
        }
        return false;
    }

    public Optional<GroupPermission> getPermissionById(Integer permissionId) {
        return groupPermissionRepository.findById(permissionId);
    }

    public long getPermissionCountForGroup(Integer groupId) {
        return groupPermissionRepository.countByGroupId(groupId);
    }
    
    public Map<Integer, Long> getPermissionCountsForGroups(List<Integer> groupIds) {
        return groupIds.stream()
                .collect(Collectors.toMap(
                    groupId -> groupId,
                    this::getPermissionCountForGroup
                ));
    }
}
