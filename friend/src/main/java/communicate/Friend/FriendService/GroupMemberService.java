package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.GroupMember;
import communicate.Friend.FriendRepositories.GroupMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class GroupMemberService {
    @Autowired
    private GroupMemberRepository groupMemberRepository;

    public List<GroupMember> addFriendToGroups(Long friendId, List<Long> groupIds) {
        List<GroupMember> members = new ArrayList<>();
        for (Long groupId : groupIds) {
            GroupMember member = new GroupMember();
            member.setFriendId(friendId);
            member.setGroupId(groupId);
            members.add(groupMemberRepository.save(member));
        }
        return members;
    }

    public List<GroupMember> addFriendsToGroup(List<Long> friendIds, Long groupId) {
        List<GroupMember> members = new ArrayList<>();
        for (Long friendId : friendIds) {
            GroupMember member = new GroupMember();
            member.setFriendId(friendId);
            member.setGroupId(groupId);
            members.add(groupMemberRepository.save(member));
        }
        return members;
    }

    public List<GroupMember> addFriendsToGroups(List<Long> friendIds, List<Long> groupIds) {
        List<GroupMember> members = new ArrayList<>();
        for (Long friendId : friendIds) {
            for (Long groupId : groupIds) {
                GroupMember member = new GroupMember();
                member.setFriendId(friendId);
                member.setGroupId(groupId);
                members.add(groupMemberRepository.save(member));
            }
        }
        return members;
    }
}
