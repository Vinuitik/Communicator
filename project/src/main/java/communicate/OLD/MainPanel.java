package communicate.OLD;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public class MainPanel extends JPanel {
    private FriendReminderUI mainFrame;

    public MainPanel(FriendReminderUI mainFrame) {
        this.mainFrame = mainFrame;
        setLayout(new BorderLayout());

        // Create the buttons
        JButton addFriendButton = new JButton("Add Friend");
        JButton viewAllFriendsButton = new JButton("View All Friends");
        JButton viewThisWeekButton = new JButton("View This Week Planned");
        JButton viewStatsButton = new JButton("View Stats");

        // Button panel at the bottom
        JPanel buttonPanel = new JPanel();
        buttonPanel.setLayout(new FlowLayout());
        buttonPanel.add(addFriendButton);
        buttonPanel.add(viewAllFriendsButton);
        buttonPanel.add(viewThisWeekButton);
        buttonPanel.add(viewStatsButton);

        add(buttonPanel, BorderLayout.SOUTH);

        // Action listeners for the buttons
        addFriendButton.addActionListener(e -> mainFrame.setContentPane(new AddFriendPanel(mainFrame)));
        viewAllFriendsButton.addActionListener(e -> mainFrame.setContentPane(new ViewAllFriendsPanel(mainFrame)));
        viewThisWeekButton.addActionListener(e -> mainFrame.setContentPane(new ViewThisWeekPanel(mainFrame)));

        mainFrame.revalidate();
    }
}
