package coommunicator.connections.Connections.ConnectionsEntities;

import java.io.Serializable;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.util.Objects;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ConnectionId implements Serializable {
    private Long friend1Id;
    private Long friend2Id;
}
