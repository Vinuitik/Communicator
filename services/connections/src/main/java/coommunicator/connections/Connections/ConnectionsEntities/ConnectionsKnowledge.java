package coommunicator.connections.Connections.ConnectionsEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import com.communicator.knowledgecore.entities.AbstractFact;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@Entity
public class ConnectionsKnowledge extends AbstractFact {

    @ManyToOne
    @JoinColumns({
        @JoinColumn(name = "friend1_id", referencedColumnName = "friend1Id"),
        @JoinColumn(name = "friend2_id", referencedColumnName = "friend2Id")
    })
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}
