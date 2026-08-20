package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.communicator.knowledgecore.service.AbstractFactService;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class FriendKnowledgeService extends AbstractFactService<FriendKnowledge, Integer> {

    private final FriendKnowledgeRepository knowledgeRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    protected JpaRepository<FriendKnowledge, Integer> repository() {
        return knowledgeRepository;
    }

    // Overriding save/saveAll/update (rather than hooking each call site individually)
    // is the one choke point every current AND future add/update path funnels through —
    // OutboxWriteService's applyTalkedToFriend/applyAddFriend/applyAddKnowledge all end
    // up calling one of these three, as does FriendKnowledgeController's updateKnowledge.
    // Published event is picked up by knowledge-core's KnowledgeChunkTriggerListener
    // (AFTER_COMMIT) — see that class for why eager chunking is dispatched there and not
    // inline here.
    @Override
    public FriendKnowledge save(FriendKnowledge item) {
        FriendKnowledge saved = super.save(item);
        publishChunkTrigger(saved);
        return saved;
    }

    @Override
    public List<FriendKnowledge> saveAll(List<FriendKnowledge> items) {
        List<FriendKnowledge> saved = super.saveAll(items);
        saved.forEach(this::publishChunkTrigger);
        return saved;
    }

    @Override
    public FriendKnowledge update(Integer id, FriendKnowledge changes) {
        FriendKnowledge saved = super.update(id, changes);
        publishChunkTrigger(saved);
        return saved;
    }

    private void publishChunkTrigger(FriendKnowledge knowledge) {
        Integer friendId = knowledge.getFriend() != null ? knowledge.getFriend().getId() : null;
        eventPublisher.publishEvent(new KnowledgeChunkTriggerEvent(
                knowledge.getId(), "FRIEND", friendId, null, null, null, knowledge.getText()));
    }

    @Transactional
    public void insertKnowledge(FriendKnowledge knowledge, Integer friendId){
        Friend friend = new Friend();
        friend.setId(friendId);
        knowledge.setFriend(friend);
        save(knowledge);
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
    public void saveAll(List<FriendKnowledge> knowledges, Integer friendId){
        for (FriendKnowledge k : knowledges) {
            Friend f = new Friend();
            f.setId(friendId);
            k.setFriend(f);
        }
        saveAll(knowledges);
    }

    @Transactional
    public void deleteKnowledgeById(Integer id){
        deleteById(id);
    }

    // Kept nullable-sentinel behavior (never throws) — two controller call sites
    // treat "no such id" as `.getId() == null`, not a caught exception.
    @Transactional
    public FriendKnowledge getKnowledgeById(Integer id){
        return findById(id).orElse(new FriendKnowledge());
    }

    @Transactional
    public Page<FriendKnowledge> getKnowledgeByFriendIdPaginated(Integer friendId, int page, int size){
        return knowledgeRepository.findByFriendId(friendId, priorityPage(page, size));
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
        return getKnowledgeByFriendId(friendId).stream()
                .map(FriendKnowledge::getId)
                .toList();
    }

}
