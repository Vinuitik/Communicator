package communicate.Friend.FriendEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Data
@Builder
public class Social {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private String URL;
    private String platform; // e.g., "Instagram", "Twitter", "LinkedIn", "Phone", "Email"
    private String displayName; // e.g., "@username" or "display name"

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;

}
