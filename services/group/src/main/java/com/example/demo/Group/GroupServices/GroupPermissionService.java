package com.example.demo.Group.GroupServices;

import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;

import com.communicator.knowledgecore.service.AbstractFactService;

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
public class GroupPermissionService extends AbstractFactService<GroupPermission, Integer> {

    private final GroupPermissionRepository groupPermissionRepository;
    private final SocialGroupRepository socialGroupRepository;

    @Override
    protected JpaRepository<GroupPermission, Integer> repository() {
        return groupPermissionRepository;
    }

    @Transactional
    public List<GroupPermission> addPermissionToGroup(Integer groupId, List<GroupPermission> permissionList) {
        SocialGroup group = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));

        for (GroupPermission permission : permissionList) {
            permission.setGroup(group);
            permission.setDate(LocalDate.now());
        }

        return saveAll(permissionList);
    }

    @Transactional
    public GroupPermission addSinglePermissionToGroup(Integer groupId, GroupPermission permission) {
        SocialGroup group = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));

        permission.setGroup(group);
        permission.setDate(LocalDate.now());

        return save(permission);
    }

    @Transactional
    public Page<GroupPermission> getGroupPermissionPage(Integer groupId, int page, int size) {
        return groupPermissionRepository.findByGroupId(groupId, priorityPage(page, size));
    }

    @Transactional
    public List<GroupPermission> getAllGroupPermission(Integer groupId) {
        return groupPermissionRepository.findByGroupIdOrderByDateDesc(groupId);
    }

    @Transactional
    public GroupPermission updatePermission(Integer permissionId, GroupPermission updatedPermission) {
        return update(permissionId, updatedPermission);
    }

    @Transactional
    public boolean deletePermission(Integer permissionId) {
        return deleteById(permissionId);
    }

    public Optional<GroupPermission> getPermissionById(Integer permissionId) {
        return findById(permissionId);
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
