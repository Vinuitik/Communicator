package communicate.Entities;

import jakarta.persistence.*;

import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonBackReference;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Connections {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;
    
    private String description;

    @ManyToOne
    @JoinColumn(name = "friend_id1", nullable = false)
    @JsonBackReference
    private Friend friend1;

    @ManyToOne
    @JoinColumn(name = "friend_id2", nullable = false)
    @JsonBackReference
    private Friend friend2;

    // Ensure uniqueness so (A, B) is the same as (B, A)
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Connections)) return false;
        Connections that = (Connections) o;
        return (friend1.equals(that.friend1) && friend2.equals(that.friend2)) ||
               (friend1.equals(that.friend2) && friend2.equals(that.friend1));
    }

    public int hashCode() {
        return friend1.getId() < friend2.getId() ?
                Objects.hash(friend1.getId(), friend2.getId()) :
                Objects.hash(friend2.getId(), friend1.getId());
    }
}
