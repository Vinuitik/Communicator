package communicate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendRepository friendRepository;

    @Transactional
    public List<Friend> getAllFriends(){
        try {
            return friendRepository.findAll();
        } catch (Exception e) {
           System.out.print("Error retrieving friends " + e.toString());
        }
        return new ArrayList<>();

    }

    @Transactional
    public List<Friend> findThisWeek(){
        try {
            LocalDate mondayDate = getMonday(LocalDate.now());
            LocalDate sundayDate = getSunday(LocalDate.now());
            int currentYear = LocalDate.now().getYear();

            List<Friend> friends = friendRepository.findAll();
            List<Friend> result = new ArrayList<Friend>();
            for(Friend friend:friends){

                LocalDate dateOfBirth = friend.getDateOfBirth().withYear(currentYear);
                LocalDate lastTimeSpoken = friend.getLastTimeSpoken();

                if( isBetween(dateOfBirth, mondayDate, sundayDate) || isBetween(lastTimeSpoken, mondayDate, sundayDate)){
                    result.add(friend);
                }
            }
            return result;

        } catch (Exception e) {
           System.out.print("Error retrieving friends " + e.toString());
        }
        return new ArrayList<>();
    }

    @Transactional
    public void save(Friend friend){
        try {
            friendRepository.save(friend);
        } catch (Exception e) {
           System.out.print("Error savinf friends " + e.toString());
        }
    }

    @Transactional
    public void deleteFriendById(Integer id){
        try {
            friendRepository.deleteById(id);
        } catch (Exception e) {
           System.out.print("Error deleting friends " + e.toString());
        }
    }

    @Transactional
    public boolean exists(Integer id){
        try {
            return friendRepository.existsById(id);
        } catch (Exception e) {
           System.out.print("Error deleting friends " + e.toString());
        }
        return false;
    }

    @Transactional
    public void updateFriend(Integer id, Friend friend){
        Optional<Friend> friendDBOptional = friendRepository.findById(id);
        if (friendDBOptional.isPresent()) {
            Friend friendDB = friendDBOptional.get();
            if(friendDB.getName() == null || friend.getName()!= null){
                friendDB.setName(friend.getName());
            }
            if(friendDB.getLastTimeSpoken() == null || friend.getLastTimeSpoken()!= null){
                friendDB.setLastTimeSpoken(friend.getLastTimeSpoken());
            }
            if(friendDB.getExperience() == null || friend.getExperience()!= null){
                friendDB.setExperience(friend.getExperience());
            }
            if(friendDB.getDateOfBirth() == null || friend.getDateOfBirth()!= null){
                friendDB.setDateOfBirth(friend.getDateOfBirth());
            }
            friendRepository.save(friendDB);
        } else {
            System.out.print("Friend not found with id " + id);
        }
    }



    private boolean isBetween(LocalDate date, LocalDate left, LocalDate right) {
        return date.isEqual(right)||date.isEqual(right)||( date.isAfter(left) && date.isBefore(right) );
    }

    
    public LocalDate getMonday(LocalDate date) {
        while (date.getDayOfWeek() != DayOfWeek.MONDAY) {
            date = date.minusDays(1);
        }
        return date;
    }

    public LocalDate getSunday(LocalDate date) {
        while (date.getDayOfWeek() != DayOfWeek.SUNDAY) {
            date = date.plusDays(1);
        }
        return date;
    }




















    public void setMeetingTime(String stars, Friend friend){
        LocalDate meetingDate = friend.getLastTimeSpoken();
        switch (stars) {
            case "*":
                meetingDate = LocalDate.now().plusDays(1);
                break;

            case "**":
                meetingDate = LocalDate.now().plusWeeks(1);
                break;
        
            default:
                meetingDate = LocalDate.now().plusMonths(1);
                break;
        }
        
    }


}
