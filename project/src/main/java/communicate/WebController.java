package communicate;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class WebController {

    @GetMapping("/talked/{id}")
    public String showUpdateForm(@PathVariable Long id, Model model) {
        model.addAttribute("id", id); // Pass the ID to the form
        return "updateForm"; // Name of your template (e.g., updateForm.html)
    }
}
