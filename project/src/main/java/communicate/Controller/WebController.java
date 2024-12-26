package communicate.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import communicate.Entities.Friend;
import communicate.Repository.FriendRepository;
import communicate.Services.FriendService;
import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class WebController {

    private final FriendService friendService;

    @GetMapping("/talked/{id}")
    public String showFriendForm(@PathVariable(required = false) Integer id, Model model) {
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
    
}
