package com.example.demo.Group.GroupServices;

import org.springframework.stereotype.Service;
import com.example.demo.Group.GroupRepositories.GroupPermissionRepository;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupPermissionService {
    
    private final GroupPermissionRepository groupPermissionRepository;
    
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
