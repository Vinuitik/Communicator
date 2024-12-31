package communicate.Services;

import java.util.List;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import communicate.Entities.Analytics;
import communicate.Entities.Friend;
import communicate.Entities.Knowledge;
import communicate.Repository.KnowledgeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class KnowledgeService {

    private final KnowledgeRepository knowledgeRepository;

    @Modifying
    @Transactional
    public void insertKnowledge(Knowledge knowledge, Integer friendId){
        Friend friend = new Friend();
        friend.setId(friendId);
        knowledge.setFriend( friend );

        knowledgeRepository.save(knowledge);

    }

    @Transactional
    public List<Knowledge> getKnowledgeByFriendId(Integer friendId){
        return knowledgeRepository.findByFriendId(friendId);
    }
    @Transactional
    public List<Knowledge> getKnowledgeByFriendIdSorted(Integer friendId){
        return knowledgeRepository.findAllSortedByFriendIdAndPriority(friendId);
    }

    @Transactional
    public List<Knowledge> saveAll(List<Knowledge> knowledge){
        return knowledgeRepository.saveAll(knowledge);
    }

    @Transactional
    public void saveAll(List<Knowledge> knowledges, Integer friendId){
        try {
            for(Knowledge k :knowledges){
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
    public void updateKnowledge(Knowledge knowledge){
        try {
            knowledgeRepository.save(knowledge);
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }

    @Transactional
    public Knowledge getKnowledgeById(Integer id){
        try {
            return knowledgeRepository.findById(id).orElse(new Knowledge());
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
        return new Knowledge();
    }

}
