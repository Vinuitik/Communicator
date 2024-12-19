package communicate.OLD;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.ArrayList;
import communicate.MongoDB;

import org.bson.Document;

public class ViewThisWeekPanel extends JPanel {
    private FriendReminderUI mainFrame;

    public ViewThisWeekPanel(FriendReminderUI mainFrame) {
        this.mainFrame = mainFrame;
        MongoDB mongoDB = mainFrame.getMongoDB();
        setLayout(new BorderLayout());

        // Table model
        DefaultTableModel tableModel = new DefaultTableModel();
        tableModel.addColumn("Name");
        tableModel.addColumn("Last Time Spoken");
        tableModel.addColumn("Experience");
        tableModel.addColumn("Date of Birth");

        // Retrieve data from MongoDB
        ArrayList<Document> friendsThisWeek = mongoDB.findThisWeek();
        for (Document friend : friendsThisWeek) {
            String name = friend.getString("name");
            String lastTimeSpoken = friend.getString("lastTimeSpoken");
            String experience = friend.getString("experience");
            String dateOfBirth = friend.getString("dateOfBirth");

            //tableModel.addRow(new Object[]{name, lastTimeSpoken, experience, dateOfBirth});
        }

        // Table setup
        JTable table = new JTable(tableModel);
        add(new JScrollPane(table), BorderLayout.CENTER);

        // Back button
        JButton backButton = new JButton("Back");
        backButton.addActionListener(e -> mainFrame.setContentPane(new MainPanel(mainFrame)));
        add(backButton, BorderLayout.SOUTH);
    }
}

