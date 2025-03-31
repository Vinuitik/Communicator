package coommunicator.connections.Connections.ConnectionsEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Setter;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Builder
public class ConnectionPermission{

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    Integer id;

    @Lob
    String description;

    @ManyToOne
    @JoinColumn(name = "connection_id")
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}
