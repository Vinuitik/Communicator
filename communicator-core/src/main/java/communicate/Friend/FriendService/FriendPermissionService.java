package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Service;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendPermission;
import communicate.Friend.FriendRepositories.FriendPermissionRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class FriendPermissionService {

    private final FriendPermissionRepository permissionRepository;

    @Modifying
    @Transactional
    public void insertPermission(FriendPermission permission, Integer friendId){
        Friend friend = new Friend();
        friend.setId(friendId);
        permission.setFriend( friend );

        permissionRepository.save(permission);
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
    public List<FriendPermission> saveAll(List<FriendPermission> permission){
        return permissionRepository.saveAll(permission);
    }

    @Transactional
    public void saveAll(List<FriendPermission> permissions, Integer friendId){
        try {
            for(FriendPermission p : permissions){
                Friend f = new Friend();
                f.setId(friendId);
                p.setFriend(f);
                permissionRepository.save(p);
            }
        } catch (Exception e) {
           System.out.print("Error saving permission " + e.toString());
        }
    }

    @Transactional
    public void deletePermissionById(Integer id){
        try {
            permissionRepository.deleteById(id);
        } catch (Exception e) {
           System.out.print("Error deleting permission " + e.toString());
        }
    }

    @Transactional
    public void updatePermission(FriendPermission permission){
        try {
            permissionRepository.save(permission);
        } catch (Exception e) {
           System.out.print("Error updating permission " + e.toString());
        }
    }

    @Transactional
    public FriendPermission getPermissionById(Integer id){
        try {
            return permissionRepository.findById(id).orElse(new FriendPermission());
        } catch (Exception e) {
           System.out.print("Error getting permission " + e.toString());
        }
        return new FriendPermission();
    }

    @Transactional
    public Page<FriendPermission> getPermissionByFriendIdPaginated(Integer friendId, int page, int size){
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "priority"));
        return permissionRepository.findByFriendId(friendId, pageable);
    }

    // Overloaded method with default size
    @Transactional
    public Page<FriendPermission> getPermissionByFriendIdPaginated(Integer friendId, int page){
        return getPermissionByFriendIdPaginated(friendId, page, 10); // Default size = 10
    }
}
