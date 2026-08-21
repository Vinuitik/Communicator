package communicate.Friend.FriendEntities;

import java.io.Serializable;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Composite key for BanditArm: one Beta(alpha,beta) cell per (bucket, arm). */
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BanditArmId implements Serializable {
    private String contextBucket;
    private Double arm;
}
