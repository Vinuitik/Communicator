package communicate.Friend.DTOs;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MCP_Knowledge_DTO {
    Integer id;
    String fact;
    Long importance;
}
