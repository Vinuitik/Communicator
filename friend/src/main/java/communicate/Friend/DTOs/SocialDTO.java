package communicate.Friend.DTOs;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialDTO {
    private String url;
    private String platform; // e.g., "Instagram", "Twitter", "LinkedIn", "Phone", "Email"
    private String displayName; // e.g., "@username" or "display name"
}
