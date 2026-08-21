package communicate.Friend.FriendEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import com.communicator.knowledgecore.entities.AbstractFact;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class FriendPermission extends AbstractFact {

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;
}
