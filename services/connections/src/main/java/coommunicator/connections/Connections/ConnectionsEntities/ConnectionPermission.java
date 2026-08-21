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

// Was previously {id, description} only — a stub that never matched the
// friend/group Permission shape (CODE_REUSE_REPORT.md §2's "empty clone").
// Redesigned onto AbstractFact for parity (fact/importance CRUD, same as
// Knowledge). Table was confirmed empty (0 rows) before this change — no
// data migration needed, the old `description` column is just orphaned.
@Getter
@Setter
@NoArgsConstructor
@Entity
public class ConnectionPermission extends AbstractFact {

    @ManyToOne
    @JoinColumns({
        @JoinColumn(name = "friend1_id", referencedColumnName = "friend1Id"),
        @JoinColumn(name = "friend2_id", referencedColumnName = "friend2Id")
    })
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}
