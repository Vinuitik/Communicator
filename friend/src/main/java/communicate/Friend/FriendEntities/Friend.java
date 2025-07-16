package communicate.Friend.FriendEntities;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Getter;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendEntities.FriendPermission;
import communicate.Friend.FriendEntities.Social;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Data
@Builder
public class Friend {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    @NotNull(message = "Name is required")
    @Size(min = 1, max = 50, message = "Name must be between 1 and 50 characters")
    private String name;

    // Add these new fields
    @Size(max = 50, message = "Relationship type must not exceed 50 characters")
    private String relationshipType; // e.g., "Close friend", "Colleague", "Family friend"
    
    private LocalDate dateMet; // When you first met this person

    @NotNull(message = "Date is Required")
    private LocalDate plannedSpeakingTime;

    private Integer primaryPhotoId; // ID of the primary photo for this friend

    @NotNull(message = "Experience is required")
    @Size(max = 100, message = "Experience description must not exceed 100 characters")
    private String experience;

    //@NotNull(message = "Date of birth is required")
    @Past
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<FriendKnowledge> knowledge;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Analytics> analytics;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Social> socials;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<FriendPermission> permissions;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("friends")
    private List<GroupMember> members;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Videos> videos;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Photos> photos;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<PersonalResource> resources;
    

    public Friend(String name, LocalDate lastTimeSpoken, String experience, LocalDate dateOfBirth) {
        setName(name);
        setPlannedSpeakingTime(lastTimeSpoken);
        setExperience(experience);
        setDateOfBirth(dateOfBirth);
    }
}
