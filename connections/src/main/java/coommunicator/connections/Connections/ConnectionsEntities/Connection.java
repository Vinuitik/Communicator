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

    @EmbeddedId
    private ConnectionId id;
    
    private String description;

    @OneToMany(mappedBy = "connection",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ConnectionsKnowledge> knowledge;

    @OneToMany(mappedBy = "connection",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ConnectionPermission> permission;

    public Connection(Long friendA, Long friendB) {
        this.id = new ConnectionId(Math.min(friendA, friendB), Math.max(friendA, friendB));
    }

    // Lombok will generate constructors, getters, setters, etc.
}
