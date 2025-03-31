<<<<<<<< HEAD:friend/src/main/java/communicate/WebController.java
package communicate;
========
package communicate.Support;
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Support/WebController.java

import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class WebController {

    private final FriendService friendService;
    private final FriendKnowledgeService knowledgeService;

    @GetMapping("/talked/{id}")
    public String showFriendForm(@PathVariable(required = true) Integer id, Model model) {
        Friend friend = friendService.findById(id);
        model.addAttribute("friend", friend);
        return "talkedForm"; // Your Thymeleaf template name
    }

    @GetMapping("index")
    public String index() {
        return "forward:/index.html";
    }

    @GetMapping("stats")
    public String stats() {
        return "forward:/analytics/analytics.html";
<<<<<<<< HEAD:friend/src/main/java/communicate/WebController.java
    }

    @GetMapping("profile/{id}")
    public String profile(@PathVariable Integer id) {
        return "forward:/profile/profile.html";
========
>>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/src/main/java/communicate/Support/WebController.java
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
