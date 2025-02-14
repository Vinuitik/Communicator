package communicate.Entities;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Connections {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;
    
    private String description;


    @ManyToOne
    @JoinColumn(name = "friend_id1")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend1;

    @ManyToOne
    @JoinColumn(name = "friend_id1")
    @JsonBackReference
    @ToString.Exclude
    private Friend friend2;
}
