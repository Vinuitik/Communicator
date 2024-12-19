package communicate.OLD;

import javax.swing.*;
import java.awt.*;
import communicate.MongoDB;
import communicate.OLD.MainPanel;

public class FriendReminderUI extends JFrame {
    private JPanel mainPanel;
    private MongoDB mongoDB;

    public FriendReminderUI() {
        // Initialize MongoDB connection
        mongoDB = new MongoDB();
        
        // Set up the main frame
        setTitle("Friend Reminder App");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(800, 600);
        setLayout(new BorderLayout());

        // Create the main panel with navigation buttons
        mainPanel = new MainPanel(this);
        add(mainPanel, BorderLayout.CENTER);

        // Apply a modern theme (optional)
        try {
            UIManager.setLookAndFeel(new com.formdev.flatlaf.FlatLightLaf());
        } catch (Exception e) {
            e.printStackTrace();
        }

        setVisible(true);
    }

    public MongoDB getMongoDB() {
        return mongoDB;
    }

    public static void main(String[] args) {
        new FriendReminderUI();
    }
}
