package com.example.demo.Group.GroupServices;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SocialGroupService {

    private final SocialGroupRepository socialGroupRepository;

    public List<SocialGroup> getAllGroups() {
        return socialGroupRepository.findAll();
    }

    public SocialGroup getGroupById(Integer id) {
        Optional<SocialGroup> group = socialGroupRepository.findById(id);
        return group.orElse(null);
    }

    public SocialGroup createGroup(SocialGroup group) {
        return socialGroupRepository.save(group);
    }

    public SocialGroup updateGroup(Integer id, SocialGroup updatedGroup) {
        if (socialGroupRepository.existsById(id)) {
            updatedGroup.setId(id);
            return socialGroupRepository.save(updatedGroup);
        }
        return null;
    }

    public boolean deleteGroup(Integer id) {
        if (socialGroupRepository.existsById(id)) {
            socialGroupRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
