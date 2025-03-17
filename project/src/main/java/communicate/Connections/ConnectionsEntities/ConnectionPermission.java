package communicate.Connections.ConnectionsEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import communicate.Connections.ConnectionsEntities.Connection;
import communicate.Support.Permission;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class ConnectionPermission extends Permission{
    @ManyToOne
    @JoinColumn(name = "connection_id")
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}
