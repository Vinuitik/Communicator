package communicate.Services;

import java.util.List;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

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

}
