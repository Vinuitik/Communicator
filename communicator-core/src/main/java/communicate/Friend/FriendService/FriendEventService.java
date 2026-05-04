package communicate.Friend.FriendService;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.FriendEvent;
import communicate.Friend.FriendRepositories.FriendEventRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class FriendEventService {

    private final FriendEventRepository friendEventRepository;

    @Transactional(readOnly = true)
    public List<FriendEvent> getByFriendId(Integer friendId) {
        return friendEventRepository.findByFriendId(friendId);
    }

    @Transactional(readOnly = true)
    public Optional<FriendEvent> getByIdAndFriendId(Integer eventId, Integer friendId) {
        return friendEventRepository.findByIdAndFriendId(eventId, friendId);
    }

    @Transactional(readOnly = true)
    public Optional<FriendEvent> getById(Integer eventId) {
        return friendEventRepository.findById(eventId);
    }

    public FriendEvent save(FriendEvent friendEvent) {
        return friendEventRepository.save(friendEvent);
    }

    public void deleteById(Integer eventId) {
        friendEventRepository.deleteById(eventId);
    }

    public FriendEvent updateForFriend(Integer eventId, Integer friendId, FriendEvent updateData) {
        Optional<FriendEvent> existingOpt = friendEventRepository.findByIdAndFriendId(eventId, friendId);
        if (existingOpt.isEmpty()) {
            return null;
        }

        FriendEvent existing = existingOpt.get();

        if (updateData.getEventType() != null) {
            existing.setEventType(updateData.getEventType());
        }

        if (updateData.getTitle() != null) {
            existing.setTitle(updateData.getTitle());
        }

        if (updateData.getBaseDate() != null) {
            existing.setBaseDate(updateData.getBaseDate());
        }

        if (updateData.getRecurrenceDays() != null) {
            existing.setRecurrenceDays(updateData.getRecurrenceDays());
        }

        if (updateData.getKeepMeetingDate() != null) {
            existing.setKeepMeetingDate(updateData.getKeepMeetingDate());
        }

        if (updateData.getActive() != null) {
            existing.setActive(updateData.getActive());
        }

        if (updateData.getNotes() != null) {
            existing.setNotes(updateData.getNotes());
        }

        return friendEventRepository.save(existing);
    }

    public boolean deleteForFriend(Integer eventId, Integer friendId) {
        Optional<FriendEvent> existingOpt = friendEventRepository.findByIdAndFriendId(eventId, friendId);
        if (existingOpt.isEmpty()) {
            return false;
        }
        friendEventRepository.delete(existingOpt.get());
        return true;
    }
}
