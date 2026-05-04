package communicate.Friend.FriendEntities;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
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
public class Meeting {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    @NotNull(message = "Meeting date is required")
    @Column(name = "meeting_date")
    private LocalDate meetingDate;

    @Builder.Default
    private String status = "PLANNED";

    @Builder.Default
    private String source = "MANUAL";

    @ManyToOne
    @JoinColumn(name = "friend_id", nullable = false)
    @JsonBackReference("friend-meetings")
    @ToString.Exclude
    private Friend friend;

    @ManyToOne
    @JoinColumn(name = "event_id")
    @JsonBackReference("event-meetings")
    @ToString.Exclude
    private FriendEvent event;
}
