package com.example.demo.Group.GroupServices;

import com.example.demo.Group.GroupEntities.GroupSocial;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupSocialRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class GroupSocialService {

    @Autowired
    private GroupSocialRepository groupSocialRepository;

    @Autowired
    private SocialGroupRepository socialGroupRepository;

    public GroupSocial createGroupSocial(Integer groupId, GroupSocial groupSocial) {
        SocialGroup socialGroup = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));
        groupSocial.setSocialGroup(socialGroup);
        return groupSocialRepository.save(groupSocial);
    }

    public Optional<GroupSocial> getGroupSocialById(Integer socialId) {
        return groupSocialRepository.findById(socialId);
    }

    public List<GroupSocial> getAllGroupSocialsForGroup(Integer groupId) {
        SocialGroup socialGroup = socialGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with id: " + groupId));
        return socialGroup.getGroupSocials();
    }

    public GroupSocial updateGroupSocial(Integer socialId, GroupSocial groupSocialDetails) {
        GroupSocial groupSocial = groupSocialRepository.findById(socialId)
                .orElseThrow(() -> new RuntimeException("Social not found with id: " + socialId));

        groupSocial.setURL(groupSocialDetails.getURL());
        groupSocial.setPlatform(groupSocialDetails.getPlatform());
        groupSocial.setDisplayName(groupSocialDetails.getDisplayName());

        return groupSocialRepository.save(groupSocial);
    }

    public void deleteGroupSocial(Integer socialId) {
        groupSocialRepository.deleteById(socialId);
    }
}
