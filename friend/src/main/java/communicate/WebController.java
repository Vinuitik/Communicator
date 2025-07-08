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
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class WebController {

    private final FriendService friendService;
    private final FriendKnowledgeService knowledgeService;

    @GetMapping("/talked/{id}")
    public String showFriendForm(@PathVariable(required = true) Integer id, Model model) {
        Friend friend = friendService.findById(id);
        model.addAttribute("friend", friend);
        return "talkedForm"; // Your Thymeleaf template name
    }

    @GetMapping("profile/{id}")
    public String profile(@PathVariable Integer id, Model model) {
        // Add the friend ID to the model if you want to use it in the template later
        model.addAttribute("friendId", id);
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
