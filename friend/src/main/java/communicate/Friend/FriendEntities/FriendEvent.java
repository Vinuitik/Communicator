package communicate.Friend.FriendEntities;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class FriendEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    @NotNull(message = "Event type is required")
    @Size(min = 1, max = 60, message = "Event type must be between 1 and 60 characters")
    private String eventType;

    @NotNull(message = "Event title is required")
    @Size(min = 1, max = 120, message = "Event title must be between 1 and 120 characters")
    private String title;

    @NotNull(message = "Base date is required")
    @Column(name = "base_date")
    private LocalDate baseDate;

    @Builder.Default
    @Min(value = 1, message = "Recurrence days must be at least 1")
    @Column(name = "recurrence_days")
    private Integer recurrenceDays = 365;

    @Column(name = "keep_meeting_date")
    private Boolean keepMeetingDate = true;

    @Builder.Default
    private Boolean active = true;

    @Column(length = 500)
    private String notes;

    @ManyToOne
    @JoinColumn(name = "friend_id", nullable = false)
    @JsonBackReference("friend-events")
    @ToString.Exclude
    private Friend friend;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("event-meetings")
    private List<Meeting> meetings;
}
