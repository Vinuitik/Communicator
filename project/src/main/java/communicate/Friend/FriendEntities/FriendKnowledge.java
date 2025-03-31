package communicate.Friend.FriendEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;
import communicate.Friend.FriendEntities.Friend;
import communicate.Support.Knowledge;

@Entity
@Getter
@Setter
@SuperBuilder
@AllArgsConstructor
@NoArgsConstructor
public class FriendKnowledge extends Knowledge {

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;
}
