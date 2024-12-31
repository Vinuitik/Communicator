package communicate.Controller;

import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import communicate.Entities.Friend;
import communicate.Entities.Knowledge;
import communicate.Repository.FriendRepository;
import communicate.Services.FriendService;
import communicate.Services.KnowledgeService;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class WebController {

    private final FriendService friendService;
    private final KnowledgeService knowledgeService;

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
        return "forward:/analytics.html";
    }

    @GetMapping("knowledge/{id}")
    //@ResponseBody
    public String knowledge(@PathVariable(required = true) Integer id, Model model) {
        List<Knowledge> knowledges = knowledgeService.getKnowledgeByFriendIdSorted(id);
        //return knowledges;
        model.addAttribute("knowledges", knowledges);
        return "facts.html";
    }
    
}
