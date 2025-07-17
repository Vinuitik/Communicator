package communicate;


import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMethod;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendService.FileMetaDataReadService;
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.PaginationLogicService;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class WebController {

    private final FriendService friendService;
    private final FriendKnowledgeService knowledgeService;
    private final FileMetaDataReadService fileMetaDataReadService;
    private final PaginationLogicService paginationLogicService;


    @GetMapping("/talked/{id}")
    public String showFriendForm(@PathVariable(required = true) Integer id, Model model) {
        Friend friend = friendService.findById(id);
        model.addAttribute("friend", friend);
        return "talkedForm"; // Your Thymeleaf template name
    }

    @GetMapping("profile/{id}")
    public String profile(@PathVariable Integer id, Model model) {
        // Add the friend ID to the model if you want to use it in the template later
        // Get media with pagination

        int page = 1; // You can change this to get different pages

        Friend friend = friendService.findById(id);
        Integer mainPhotoId = friend.getPrimaryPhotoId();
        Photos mainPhoto = null;
        String mainPhotoName = null;
        if(mainPhotoId != null) {
            mainPhoto = fileMetaDataReadService.getPhotoById(mainPhotoId);
            mainPhotoName =  mainPhoto.getPhotoName();
        }
        List<Integer> mediaAllocations = paginationLogicService.getMediaAllocations(page,id);
        List<Integer> mediaOffsets = paginationLogicService.getMediaOffsets(page);

        List<Photos> photos = fileMetaDataReadService.getPhotosByFriendIdWithLimitOffset(id, mediaOffsets.get(0),mediaAllocations.get(0));
        List<Videos> videos = fileMetaDataReadService.getVideosByFriendIdWithLimitOffset(id, mediaOffsets.get(1),mediaAllocations.get(1));
        List<PersonalResource> resources = fileMetaDataReadService.getResourcesByFriendIdWithLimitOffset(id, mediaOffsets.get(2),mediaAllocations.get(2));
        
        // Add to model
        model.addAttribute("friend", friend);
        model.addAttribute("mainPhotoName", mainPhotoName);
        model.addAttribute("friendId", id);
        model.addAttribute("photos", photos);
        model.addAttribute("videos", videos);
        model.addAttribute("resources", resources);
        model.addAttribute("currentPage", 0); // Assuming you start from page 0
        return "profile"; // This will serve profile.html from templates folder
    }

    @GetMapping("knowledge/{id}")
    //@ResponseBody
    public String knowledge(@PathVariable(required = true) Integer id, Model model) {
        List<FriendKnowledge> knowledges = knowledgeService.getKnowledgeByFriendIdSorted(id);
        //return knowledges;
        model.addAttribute("knowledges", knowledges);
        return "facts.html";
    }
    
}
