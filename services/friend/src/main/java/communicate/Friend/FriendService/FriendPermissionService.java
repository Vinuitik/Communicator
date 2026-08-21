package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;

import com.communicator.knowledgecore.service.AbstractFactService;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendPermission;
import communicate.Friend.FriendRepositories.FriendPermissionRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class FriendPermissionService extends AbstractFactService<FriendPermission, Integer> {

    private final FriendPermissionRepository permissionRepository;

    @Override
    protected JpaRepository<FriendPermission, Integer> repository() {
        return permissionRepository;
    }

    @Transactional
    public void insertPermission(FriendPermission permission, Integer friendId){
        Friend friend = new Friend();
        friend.setId(friendId);
        permission.setFriend(friend);
        save(permission);
    }

    @Transactional
    public List<FriendPermission> getPermissionByFriendId(Integer friendId){
        return permissionRepository.findByFriendId(friendId);
    }

    @Transactional
    public List<FriendPermission> getPermissionByFriendIdSorted(Integer friendId){
        return permissionRepository.findAllSortedByFriendIdAndPriority(friendId);
    }

    @Transactional
    public void deletePermissionById(Integer id){
        deleteById(id);
    }

    // Kept nullable-sentinel behavior (never throws) — two controller call sites
    // treat "no such id" as `.getId() == null`, not a caught exception.
    @Transactional
    public FriendPermission getPermissionById(Integer id){
        return findById(id).orElse(new FriendPermission());
    }

    @Transactional
    public Page<FriendPermission> getPermissionByFriendIdPaginated(Integer friendId, int page, int size){
        return permissionRepository.findByFriendId(friendId, priorityPage(page, size));
    }

    // Overloaded method with default size
    @Transactional
    public Page<FriendPermission> getPermissionByFriendIdPaginated(Integer friendId, int page){
        return getPermissionByFriendIdPaginated(friendId, page, 10); // Default size = 10
    }
}
