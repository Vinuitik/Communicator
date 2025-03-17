package communicate.Connections.ConnectionsEntities;

import jakarta.persistence.Entity;

import com.fasterxml.jackson.annotation.JsonBackReference;

import communicate.Support.Knowledge;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.ToString;

import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.experimental.SuperBuilder;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@SuperBuilder
public class ConnectionsKnowledge extends Knowledge {

    @ManyToOne
    @JoinColumn(name = "connection_id")
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}