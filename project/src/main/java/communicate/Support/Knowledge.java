<<<<<<<< HEAD:friend/src/main/java/communicate/Friend/FriendEntities/FriendKnowledge.java
package communicate.Friend.FriendEntities;
========
package communicate.Support;
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Support/Knowledge.java

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.ToString;
<<<<<<<< HEAD:friend/src/main/java/communicate/Friend/FriendEntities/FriendKnowledge.java
import communicate.Friend.FriendEntities.Friend;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class FriendKnowledge  {
========
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Knowledge {
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Support/Knowledge.java

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private LocalDate date;

    @Lob
    @JsonProperty("fact")
    @NotNull(message = "Text is required")
    private String text;
    
    @NotNull(message = "Priority is required")
    @JsonProperty("importance")
    private Long priority;

    private LocalDate reviewDate;
    
    private Integer interval;

<<<<<<<< HEAD:friend/src/main/java/communicate/Friend/FriendEntities/FriendKnowledge.java
    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;
========
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Support/Knowledge.java
}
