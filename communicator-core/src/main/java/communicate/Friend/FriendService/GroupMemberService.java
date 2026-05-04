package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.GroupMember;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.GroupMemberRepository;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class GroupMemberService {
    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private EntityManager entityManager;

    public List<GroupMember> addFriendToGroups(Integer friendId, List<Integer> groupIds) {
        List<GroupMember> members = new ArrayList<>();
        Friend friendProxy = entityManager.getReference(Friend.class, friendId);
        for (Integer groupId : groupIds) {
            GroupMember member = GroupMember.builder()
                    .groupId(groupId)
                    .friend(friendProxy)
                    .build();
            members.add(groupMemberRepository.save(member));
        }
        return members;
    }

    public List<GroupMember> addFriendsToGroup(List<Integer> friendIds, Integer groupId) {
        List<GroupMember> members = new ArrayList<>();
        for (Integer friendId : friendIds) {
            Friend friendProxy = entityManager.getReference(Friend.class, friendId);
            GroupMember member = GroupMember.builder()
                    .groupId(groupId)
                    .friend(friendProxy)
                    .build();
            members.add(groupMemberRepository.save(member));
        }
        return members;
    }

    public List<GroupMember> addFriendsToGroups(List<Integer> friendIds, List<Integer> groupIds) {
        List<GroupMember> members = new ArrayList<>();
        for (Integer friendId : friendIds) {
            Friend friendProxy = entityManager.getReference(Friend.class, friendId);
            for (Integer groupId : groupIds) {
                GroupMember member = GroupMember.builder()
                        .groupId(groupId)
                        .friend(friendProxy)
                        .build();
                members.add(groupMemberRepository.save(member));
            }
        }
        return members;
    }

    // Get all groups for a specific friend
    public List<Integer> getGroupsByFriendId(Integer friendId) {
        return groupMemberRepository.findGroupIdsByFriendId(friendId);
    }

    // Get all group members for a specific friend
    public List<GroupMember> getGroupMembersByFriendId(Integer friendId) {
        return groupMemberRepository.findByFriend_Id(friendId);
    }

    // Get all friends in a specific group
    public List<Friend> getFriendsByGroupId(Integer groupId) {
        return groupMemberRepository.findFriendsByGroupId(groupId);
    }

    // Get all group members for a specific group
    public List<GroupMember> getGroupMembersByGroupId(Integer groupId) {
        return groupMemberRepository.findByGroupId(groupId);
    }
}
