package communicate.Friend.FriendService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.DTOs.SocialDTO;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.Social;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendRepositories.SocialRepository;
import lombok.RequiredArgsConstructor;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class SocialService {
    
    private final SocialRepository socialRepository;
    private final FriendRepository friendRepository;

    /**
     * Get all social media links for a specific friend
     * @param friendId the ID of the friend
     * @return list of social media links
     */
    @Transactional(readOnly = true)
    public List<Social> getSocialsByFriendId(Integer friendId) {
        validateFriendExists(friendId);
        return socialRepository.findByFriendIdOrderByPlatform(friendId);
    }

    /**
     * Create a new social media link for a friend
     * @param friendId the ID of the friend
     * @param socialDTO the social media data
     * @return the created social media link
     */
    public Social createSocial(Integer friendId, SocialDTO socialDTO) {
        validateSocialDTO(socialDTO);
        
        Friend friend = friendRepository.findById(friendId)
            .orElseThrow(() -> new IllegalArgumentException("Friend not found with ID: " + friendId));

        Social social = Social.builder()
            .URL(socialDTO.getUrl())
            .platform(socialDTO.getPlatform())
            .displayName(socialDTO.getDisplayName())
            .friend(friend)
            .build();

        return socialRepository.save(social);
    }

    /**
     * Update an existing social media link
     * @param socialId the ID of the social media link
     * @param socialDTO the updated social media data
     * @return the updated social media link
     */
    public Social updateSocial(Integer socialId, SocialDTO socialDTO) {
        validateSocialDTO(socialDTO);
        
        Social existingSocial = socialRepository.findById(socialId)
            .orElseThrow(() -> new IllegalArgumentException("Social media link not found with ID: " + socialId));

        existingSocial.setURL(socialDTO.getUrl());
        existingSocial.setPlatform(socialDTO.getPlatform());
        existingSocial.setDisplayName(socialDTO.getDisplayName());

        return socialRepository.save(existingSocial);
    }

    /**
     * Delete a social media link
     * @param socialId the ID of the social media link to delete
     */
    public void deleteSocial(Integer socialId) {
        if (!socialRepository.existsById(socialId)) {
            throw new IllegalArgumentException("Social media link not found with ID: " + socialId);
        }
        socialRepository.deleteById(socialId);
    }

    /**
     * Get social media links by platform for a friend
     * @param friendId the ID of the friend
     * @param platform the platform name
     * @return list of social media links for the platform
     */
    @Transactional(readOnly = true)
    public List<Social> getSocialsByFriendIdAndPlatform(Integer friendId, String platform) {
        validateFriendExists(friendId);
        return socialRepository.findByFriendIdAndPlatform(friendId, platform);
    }

    /**
     * Validate that a friend exists
     * @param friendId the ID of the friend to validate
     */
    private void validateFriendExists(Integer friendId) {
        if (!friendRepository.existsById(friendId)) {
            throw new IllegalArgumentException("Friend not found with ID: " + friendId);
        }
    }

    /**
     * Validate social DTO input
     * @param socialDTO the social DTO to validate
     */
    private void validateSocialDTO(SocialDTO socialDTO) {
        if (socialDTO == null) {
            throw new IllegalArgumentException("Social data cannot be null");
        }
        
        if (socialDTO.getUrl() == null || socialDTO.getUrl().trim().isEmpty()) {
            throw new IllegalArgumentException("URL cannot be empty");
        }
        
        if (socialDTO.getPlatform() == null || socialDTO.getPlatform().trim().isEmpty()) {
            throw new IllegalArgumentException("Platform cannot be empty");
        }
        
        // Validate URL format (basic validation)
        String url = socialDTO.getUrl().trim();
        if (!isValidUrl(url)) {
            throw new IllegalArgumentException("Invalid URL format");
        }
    }

    /**
     * Comprehensive URL/contact validation
     * @param url the URL/contact to validate
     * @return true if URL/contact is valid, false otherwise
     */
    private boolean isValidUrl(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        
        String trimmedUrl = url.trim();
        
        // Check for HTTP/HTTPS URLs
        if (trimmedUrl.matches("^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}.*$")) {
            return true;
        }
        
        // Check for telephone protocols
        if (trimmedUrl.matches("^tel:\\+?[0-9\\s\\-\\(\\)]+$")) {
            return true;
        }
        
        // Check for email protocols
        if (trimmedUrl.matches("^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")) {
            return true;
        }
        
        // Check for phone numbers (with or without + sign, allowing various formats)
        // Supports: +1234567890, +1 234 567 890, +1-234-567-890, +1 (234) 567-890, etc.
        if (trimmedUrl.matches("^\\+?[1-9]\\d{0,3}[\\s\\-]?\\(?\\d{1,4}\\)?[\\s\\-]?\\d{1,4}[\\s\\-]?\\d{1,9}$")) {
            return true;
        }
        
        // Check for email addresses
        if (trimmedUrl.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")) {
            return true;
        }
        
        // Check for social media usernames (starting with @)
        if (trimmedUrl.matches("^@[a-zA-Z0-9._-]+$")) {
            return true;
        }
        
        // Check for generic URLs without protocol (will be treated as website)
        if (trimmedUrl.matches("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}.*$")) {
            return true;
        }
        
        // For platforms like WhatsApp, Telegram that might use custom formats
        if (trimmedUrl.length() >= 3 && !trimmedUrl.contains(" ") && trimmedUrl.contains(".")) {
            return true;
        }
        
        return false;
    }
}
