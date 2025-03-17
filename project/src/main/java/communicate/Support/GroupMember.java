package communicate.Support;

import com.fasterxml.jackson.annotation.JsonBackReference;

import communicate.Friend.FriendEntities.Friend;
import communicate.Group.GroupEntities.SocialGroup;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Builder;

@Entity
@Table(name = "members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"group_id", "friend_id"}) // Enforces uniqueness
})
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class GroupMember {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    Integer id; // I think we need to replace it into unique id of GROUP, FRIEND

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;
}
