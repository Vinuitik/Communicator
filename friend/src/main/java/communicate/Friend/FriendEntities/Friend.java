package communicate.Friend.FriendEntities;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Getter;

import java.time.LocalDate;
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
import jakarta.validation.constraints.Size;

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

    // Exponential Moving Averages - calculated by chrono service
    @Builder.Default
    @Column(name = "average_frequency")
    private Double averageFrequency = 0.0;

    @Builder.Default
    @Column(name = "average_duration")
    private Double averageDuration = 0.0;

    @Builder.Default
    @Column(name = "average_excitement")
    private Double averageExcitement = 0.0;

    @Builder.Default
    @Column(name = "average_proximity")
    private Double averageProximity = 0.0;

    // FSRS scheduling state (ReviewService) — null until this friend's first
    // reviewed interaction (see design doc's cold-start/backfill step). Kept
    // separate from the average_* EMA columns above: those are visualization-
    // only, this is the scheduling-only fused state (design doc premise 4).
    @Column(name = "fsrs_stability")
    private Double fsrsStability;

    @Column(name = "fsrs_difficulty")
    private Double fsrsDifficulty;

    // Date of the last interaction ReviewService actually graded — the
    // "lastReview" anchor for computing elapsedDays and effective-arm
    // attribution on the NEXT interaction. Distinct from plannedSpeakingTime,
    // which holds the predicted due date going forward.
    @Column(name = "last_interaction_date")
    private LocalDate lastInteractionDate;

    // The bandit arm/bucket ReviewService chose for the CURRENT
    // plannedSpeakingTime prediction — read back on the next interaction to
    // credit the reward to the effective (actually-realised) arm, same
    // pattern as OO's ReviewService/NoteReviewRepository.pendingArm.
    @Column(name = "pending_bandit_arm")
    private Double pendingBanditArm;

    @Column(name = "pending_bandit_bucket")
    private String pendingBanditBucket;

    // Contact-expectation role (design doc premise 10) — resolves to a
    // desiredRetention target via RoleProperties, replacing FSRS's single
    // global default with a per-friend one (a partner's daily-contact norm
    // vs. a casual friend's quarterly comfort). Free string, not an enum, so
    // new presets can be added in application.yml without a code change;
    // "Casual" is the sensible default for friends who never get one
    // assigned (design doc Open Questions).
    @Builder.Default
    @Column(name = "role")
    private String role = "Casual";


    public Friend(String name, LocalDate lastTimeSpoken, String experience, LocalDate dateOfBirth) {
        setName(name);
        setPlannedSpeakingTime(lastTimeSpoken);
        setExperience(experience);
        setDateOfBirth(dateOfBirth);
    }
}
