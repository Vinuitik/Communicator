package communicate.AI;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class Embedding {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    private Integer knowledgeId;

    private String knowledgeType;//Friend, Connection, Group

    @Convert(converter = VectorConverter.class) // Converts double[] to a string for PostgreSQL
    private double[] embedding;
}

