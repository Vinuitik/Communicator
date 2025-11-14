package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Service;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class FriendKnowledgeService {

    private final FriendKnowledgeRepository knowledgeRepository;

    @Modifying
    @Transactional
    public void insertKnowledge(FriendKnowledge knowledge, Integer friendId){
        Friend friend = new Friend();
        friend.setId(friendId);
        knowledge.setFriend( friend );

        knowledgeRepository.save(knowledge);

    }

    @Transactional
    public List<FriendKnowledge> getKnowledgeByFriendId(Integer friendId){
        return knowledgeRepository.findByFriendId(friendId);
    }
    @Transactional
    public List<FriendKnowledge> getKnowledgeByFriendIdSorted(Integer friendId){
        return knowledgeRepository.findAllSortedByFriendIdAndPriority(friendId);
    }

    @Transactional
    public List<FriendKnowledge> saveAll(List<FriendKnowledge> knowledge){
        return knowledgeRepository.saveAll(knowledge);
    }

    @Transactional
    public void saveAll(List<FriendKnowledge> knowledges, Integer friendId){
        try {
            for(FriendKnowledge k :knowledges){
                Friend f = new Friend();
                f.setId(friendId);
                k.setFriend(f);
                knowledgeRepository.save(k);
            }
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }

    @Transactional
    public void deleteKnowledgeById(Integer id){
        try {
            knowledgeRepository.deleteById(id);
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }

    @Transactional
    public void updateKnowledge(FriendKnowledge knowledge){
        try {
            knowledgeRepository.save(knowledge);
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }

    @Transactional
    public FriendKnowledge getKnowledgeById(Integer id){
        try {
            return knowledgeRepository.findById(id).orElse(new FriendKnowledge());
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
        return new FriendKnowledge();
    }

    @Transactional
    public Page<FriendKnowledge> getKnowledgeByFriendIdPaginated(Integer friendId, int page, int size){
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "priority"));
        return knowledgeRepository.findByFriendId(friendId, pageable);
    }

    // Overloaded method with default size
    @Transactional
    public Page<FriendKnowledge> getKnowledgeByFriendIdPaginated(Integer friendId, int page){
        return getKnowledgeByFriendIdPaginated(friendId, page, 10); // Default size = 10
    }

    /**
     * Get all knowledge IDs for a specific friend
     * Used by AI agent for building FAISS indexes
     */
    @Transactional
    public List<Integer> getKnowledgeIdsByFriendId(Integer friendId) {
        try {
            List<FriendKnowledge> knowledgeList = knowledgeRepository.findByFriendId(friendId);
            return knowledgeList.stream()
                    .map(FriendKnowledge::getId)
                    .toList();
        } catch (Exception e) {
            System.err.println("Error retrieving knowledge IDs for friend " + friendId + ": " + e.toString());
            return List.of();
        }
    }

}
