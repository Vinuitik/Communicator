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
import communicate.Support.GroupMember;


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

    @NotNull(message = "Date is Required")
    private LocalDate plannedSpeakingTime;

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
    @JsonManagedReference
    private List<GroupMember> members;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Videos> videos;

    @OneToMany(mappedBy = "friend",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<Photos> photos;
    

    public Friend(String name, LocalDate lastTimeSpoken, String experience, LocalDate dateOfBirth) {
        setName(name);
        setPlannedSpeakingTime(lastTimeSpoken);
        setExperience(experience);
        setDateOfBirth(dateOfBirth);
    }
}
