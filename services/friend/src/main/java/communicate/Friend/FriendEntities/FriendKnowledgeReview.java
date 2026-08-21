package communicate.Friend.FriendEntities;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A single flashcard-review "slot" over one logged fact — the friend/group
 * knowledge review feature (design doc "Feature D"). Deliberately a
 * SEPARATE FSRS state from {@link Friend#getFsrsStability()}/
 * {@link Friend#getFsrsDifficulty()}: those drive contact scheduling
 * (ReviewService), this drives "do you still remember this fact about
 * them" (FlashcardReviewService) — same math (FsrsService), independent
 * memory state.
 *
 * One row per (friend folder, source fact). A GroupKnowledge fact reviewed
 * under two different members' folders is intentionally TWO rows — shared
 * context you recall with each person individually, not deduped group
 * trivia (design doc, explicit call-out).
 */
@Entity
@Table(name = "friend_knowledge_review")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendKnowledgeReview {

    public enum SourceType {
        FRIEND, GROUP
    }

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    // The review "folder" this row belongs to — always the friend being
    // reviewed, even when sourceType is GROUP (see class javadoc). No
    // matching @JsonManagedReference list on Friend (unlike
    // knowledge/analytics/etc.) — reviews are read through DTOs, not this
    // entity graph — so this is a plain @JsonIgnore, not a paired reference.
    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonIgnore
    @ToString.Exclude
    private Friend friend;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private SourceType sourceType;

    // FriendKnowledge.id or GroupKnowledge.id depending on sourceType — not
    // an FK (those tables live in different modules; friend does depend on
    // group at the Maven level for reads, but this stays a plain id to keep
    // the two tables independently deletable).
    @Column(name = "source_knowledge_id", nullable = false)
    private Integer sourceKnowledgeId;

    // Null until this card's first grade (see FlashcardReviewService — first
    // review uses FsrsService.initialState(grade) same as Friend's own
    // fsrsStability/fsrsDifficulty in ReviewService).
    @Column(name = "fsrs_stability")
    private Double fsrsStability;

    @Column(name = "fsrs_difficulty")
    private Double fsrsDifficulty;

    @Column(name = "last_reviewed_date")
    private LocalDate lastReviewedDate;

    // Enrollment sets this to "today" (a freshly starred/added fact is
    // immediately due), same as a brand-new Anki card.
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;
}
