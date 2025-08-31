package coommunicator.connections.Connections.ConnectionsEntities;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
import lombok.ToString;

import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.Builder;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Builder
public class ConnectionsKnowledge {

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

    @ManyToOne
    @JoinColumns({
        @JoinColumn(name = "friend1_id", referencedColumnName = "friend1_id"),
        @JoinColumn(name = "friend2_id", referencedColumnName = "friend2_id")
    })
    @JsonBackReference
    @ToString.Exclude
    private Connection connection;
}