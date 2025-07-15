package communicate.Friend.FriendEntities;

import java.time.LocalDate;

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
import jakarta.persistence.Lob;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Videos {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private String videoName;

    private String mimeType;

    @Builder.Default
    private LocalDate timeBuilt = LocalDate.now();

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;
}
