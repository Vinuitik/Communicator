package communicate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;

import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.stereotype.Component;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.DeleteResult;

@Component
public class MongoDB {
     private MongoCollection<Document> friendCollection;

     public MongoDB(){
       // Initialize MongoDB connection and collection
       MongoClient mongoClient = MongoClients.create("mongodb://root:example@localhost:27018");
       MongoDatabase database = mongoClient.getDatabase("friendsDB");
       friendCollection = database.getCollection("friends");
     }
     public void insertFriend(Friend friend){
        Document newFriend = new Document("name", friend.getName())
                        .append("lastTimeSpoken", friend.getLastTimeSpoken().toString())
                        .append("experience", friend.getExperience())
                        .append("dateOfBirth", friend.getDateOfBirth().toString());
        friendCollection.insertOne(newFriend);
     }

     public ArrayList<Document> findAll(){
        ArrayList<Document> result = new ArrayList<>();
        result.addAll(friendCollection.find().into(new ArrayList<>()));
        return result;
     }

     private boolean isDateInCurrentWeek(int month, int day) {
        LocalDate today = LocalDate.now();
        LocalDate thisMonday = getMonday(today);
        LocalDate thisSunday = getSunday(today);

        // Extract the month and day for comparison purposes
        int thisMondayMonth = thisMonday.getMonthValue();
        int thisMondayDay = thisMonday.getDayOfMonth();
        int thisSundayMonth = thisSunday.getMonthValue();
        int thisSundayDay = thisSunday.getDayOfMonth();

        // Check if the date falls within the current week (ignoring the year)

        if(thisMondayMonth==thisSundayMonth){
            if(month!=thisMondayDay){
                return false;
            }
            return (day>=thisMondayDay)&&(day<=thisSundayDay);
        }
        else{
            if((month!=thisMondayMonth)&&month!=thisSundayMonth){
                return false;
            }
            return (day>=thisMondayDay)||(day<=thisSundayDay);
        }
    }

    // Refactored findThisWeek method
    public ArrayList<Document> findThisWeek() {
        // List to hold results
        ArrayList<Document> results = new ArrayList<>();

        // Retrieve all documents (you can't filter by partial date directly in MongoDB)
        for (Document doc : friendCollection.find()) {
            // Check for date of birth within this week
            String dobStr = doc.getString("dateOfBirth");
            LocalDate dateOfBirth = LocalDate.parse(dobStr);
            int dobMonth = dateOfBirth.getMonthValue();
            int dobDay = dateOfBirth.getDayOfMonth();
            boolean isBirthdayThisWeek = isDateInCurrentWeek(dobMonth, dobDay);

            System.out.println(dobMonth+" "+dobDay);


            // Check for lastTimeSpoken within this week
            String lastSpokenStr = doc.getString("lastTimeSpoken");
            LocalDate lastSpoken = LocalDate.parse(lastSpokenStr);
            int lastSpokenMonth = lastSpoken.getMonthValue();
            int lastSpokenDay = lastSpoken.getDayOfMonth();
            boolean isLastSpokenThisWeek = isDateInCurrentWeek(lastSpokenMonth, lastSpokenDay);

            System.out.println(lastSpokenMonth+" "+lastSpokenDay);

            // Add person if either condition is true
            if (isBirthdayThisWeek || isLastSpokenThisWeek) {
                results.add(doc);
            }
        }

        return results;
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
        String id = friend.getId();
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
        // Create a filter to find the document by ID
        Bson filter = Filters.eq("_id", id);

        // Create the update to set the new lastTimeSpoken date
        Bson update = Updates.set("lastTimeSpoken", meetingDate.toString());

        // Update the document in the MongoDB collection
        friendCollection.updateOne(filter, update);
    }

    public void deleteFriend(Friend friend){
        String id = friend.getId();
        Bson filter = Filters.eq("_id", id);
        friendCollection.deleteMany(filter);
    }

    public boolean deleteFriendById(String id) {
        Bson filter = Filters.eq("_id", id);
        DeleteResult result = friendCollection.deleteMany(filter);

        // Return true if at least one document was deleted, otherwise return false
        return result.getDeletedCount() > 0;
    }

}
