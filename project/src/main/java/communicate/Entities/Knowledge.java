package communicate.Entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Knowledge {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    @Lob
    @JsonProperty("fact")
    @NotNull(message = "Text id required")
    private String text;
    
    @NotNull(message = "Priority is required")
    @JsonProperty("importance")
    private Long priority;

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend;

}
