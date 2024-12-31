package communicate.Services;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.cglib.core.Local;
import org.springframework.stereotype.Service;

import communicate.DTOs.ShortFriendDTO;
import communicate.Entities.Friend;
import communicate.Repository.FriendRepository;
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

            System.out.print("\n \n \n");

            System.out.println(mondayDate.toString());
            System.out.println(sundayDate.toString());

            System.out.print("\n \n \n");

            List<Friend> friends = friendRepository.findAll();
            List<Friend> result = new ArrayList<Friend>();
            for(Friend friend:friends){

                LocalDate dateOfBirth = friend.getDateOfBirth();
                if(dateOfBirth!= null){
                    dateOfBirth = dateOfBirth.withYear(currentYear);
                }
                LocalDate lastTimeSpoken = friend.getPlannedSpeakingTime();

                //System.out.println(friend);

                System.out.print("\n \n");

                if( isBetween(dateOfBirth, mondayDate, sundayDate) || isBefore(lastTimeSpoken, sundayDate)){
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
           System.out.print("Error saving friends " + e.toString());
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
    public Friend updateFriend(Integer id, Friend friend) {
        Optional<Friend> friendDBOptional = friendRepository.findById(id);
        if (friendDBOptional.isPresent()) {
            Friend friendDB = friendDBOptional.get();
            
            boolean updated = false;

            // Explicit comparison to ensure the entity is marked as modified
            if (friend.getName() != null || friendDB.getName() == null) {
                friendDB.setName(friend.getName());
                updated = true;
            }

            if (friend.getPlannedSpeakingTime() != null || friendDB.getPlannedSpeakingTime() == null) {
                friendDB.setPlannedSpeakingTime(friend.getPlannedSpeakingTime());
                updated = true;
            }

            if (friend.getExperience() != null || friendDB.getExperience() == null) {
                friendDB.setExperience(friend.getExperience());
                updated = true;
            }

            if (friend.getDateOfBirth() != null || friendDB.getDateOfBirth() == null) {
                friendDB.setDateOfBirth(friend.getDateOfBirth());
                updated = true;
            }

            // Trigger save and flush even if no changes detected
            if (updated || friendDB != null) {
                friendRepository.save(friendDB);
                friendRepository.flush();  // Forces flush to commit changes immediately
                return friendDB;
            }
        }
        friendRepository.save(friend);
        return friend;
    }

    @Transactional
    public Friend getFriendById(Integer id){
        try {
            return friendRepository.findById(id).orElse(null);
        } catch (Exception e) {
            System.out.print("Error retrieving friend by id " + e.toString());
        }
        return null;
    }

    @Transactional
    public Friend findById(Integer id){
        if(id==null){
            return new Friend();
        }
        return friendRepository.findById(id).orElse(new Friend());
    }

    @Transactional
    public List<ShortFriendDTO> getCompressedList(){
        try {
            return friendRepository.findAllShortFriendDTOs();
        } catch (Exception e) {
            System.out.print("Error retrieving friends " + e.toString());
        }
        return new ArrayList<ShortFriendDTO>();
    }


    private boolean isBetween(LocalDate date, LocalDate left, LocalDate right) {
        if(date == null){
            return false;
        }
        boolean equalsLeft = date.isEqual(left);
        boolean equalsRight = date.isEqual(right);
        boolean between = date.isAfter(left) && date.isBefore(right);
        boolean result = equalsLeft || equalsRight || between;
        //System.out.println(result + "\n \n " );
        //result = date.isBefore(right); // update for forgetting / laziness
        return result;
    }

    private Boolean isBefore(LocalDate date, LocalDate right){
        if(date == null){
            return false;
        }
        return date.isBefore(right) || date.isEqual(right);
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






    public LocalDate setMeetingTime(String stars, LocalDate date){
        LocalDate meetingDate = LocalDate.now();
        switch (stars) {
            case "*":
                meetingDate = date.plusDays(1);
                break;

            case "**":
                meetingDate = date.plusWeeks(1);
                break;
        
            default:
                meetingDate = date.plusMonths(1);
                break;
        }

        return meetingDate;
        
    }


}
