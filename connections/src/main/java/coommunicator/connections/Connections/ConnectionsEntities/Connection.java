package coommunicator.connections.Connections.ConnectionsEntities;

import jakarta.persistence.*;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionPermission;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "connections", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"friend1_id", "friend2_id"}) // Enforces uniqueness
})
public class Connection {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @EmbeddedId
    private ConnectionId id;
    
    private String description;

    @Column(name = "friend1_id")  // Explicit column name
    private Long friend1Id;
    @Column(name = "friend2_id")  // Explicit column name
    private Long friend2Id;

    @OneToMany(mappedBy = "connection",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ConnectionsKnowledge> knowledge;

    @OneToMany(mappedBy = "connection",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ConnectionPermission> permission;

    public Connection(Long friendA, Long friendB) {
        this.friend1Id = Math.min(friendA, friendB);
        this.friend2Id = Math.max(friendA, friendB);
    }

    // Lombok will generate constructors, getters, setters, etc.
}
