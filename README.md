# Communicator - Personal Relationship Management System

## 🎯 Overview

Communicator is a comprehensive microservices-based system designed to help users manage and maintain their personal relationships through structured communication tracking, knowledge management, and social analytics. The platform provides tools to schedule interactions, store meaningful information about friends, analyze communication patterns, and manage various media resources associated with each relationship.

## 🏗️ Architecture

### Microservices Architecture
The system follows a **microservices architecture** with the following key components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     NGINX       │    │   PostgreSQL     │    │   Backup        │
│  (API Gateway)  │    │   (Database)     │    │   Service       │
│     Port 8090   │    │   Port 5433      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
    ┌────┴────────────────┬──────┴──────┬────────────────┴──────────┐
    │                     │             │                           │
┌───▼────┐         ┌─────▼────┐  ┌─────▼─────┐            ┌──────▼──────┐
│ Friend │         │  Group   │  │Connections│            │ Resource    │
│Service │         │ Service  │  │  Service  │            │ Repository  │
│8085    │         │   8086   │  │   8088    │            │    5000     │
└────────┘         └──────────┘  └───────────┘            └─────────────┘
```

### Core Services

#### 1. **Friend Service** (Port 8085) - Core Business Logic
- **Technology**: Spring Boot 3.2.1, Java 21, JPA/Hibernate
- **Primary Entity**: `Friend` with related `Knowledge`, `Analytics`, and `Connections`
- **Key Features**:
  - CRUD operations for friends
  - Weekly interaction scheduling with automatic reminder system
  - Star-based rating system for interaction quality ("*", "**", "***")
  - Smart meeting time calculation based on experience ratings
  - Analytics tracking for communication patterns

#### 2. **Group Service** (Port 8086) - Social Group Management
- **Technology**: Spring Boot, Java 21
- **Entities**: `SocialGroup`, `GroupKnowledge`, `GroupPermission`
- **Purpose**: Manage friend groups, group-specific knowledge, and permissions

#### 3. **Connections Service** (Port 8088) - Relationship Mapping
- **Technology**: Spring Boot, Java 21
- **Entities**: `Connection`, `ConnectionsKnowledge`, `ConnectionPermission`
- **Purpose**: Track bidirectional relationships between friends and associated metadata

#### 4. **Resource Repository** (Port 5000) - Media Management
- **Technology**: Python Flask
- **Purpose**: Handle file uploads, storage, and retrieval for photos, videos, voice recordings, and personal documents
- **Storage Structure**: Friend-specific folders organized by media type

#### 5. **Backup Service** - Data Protection
- **Technology**: Java with PostgreSQL backup utilities
- **Purpose**: Automated daily database backups with optional cloud storage integration

#### 6. **NGINX** (Port 8090) - API Gateway & Web Server
- **Purpose**: 
  - Reverse proxy and load balancer
  - Static file serving for frontend assets
  - API routing to microservices
  - Caching strategy implementation

## 📊 Data Model

### Core Entities

#### Friend Entity
```java
@Entity
public class Friend {
    private Integer id;
    private String name;                    // Friend's name
    private LocalDate plannedSpeakingTime; // Next scheduled interaction
    private String experience;             // Last interaction quality ("*", "**", "***")
    private LocalDate dateOfBirth;         // Birthday for reminders
    private List<Knowledge> knowledge;      // Associated facts/information
    private List<Analytics> analytics;     // Interaction history
}
```

#### Knowledge Management
```java
@Entity
public class Knowledge {
    private Integer id;
    private LocalDate date;
    private String text;        // The actual knowledge/fact
    private Long priority;      // Importance ranking
    private Friend friend;      // Associated friend
}
```

#### Analytics Tracking
```java
@Entity
public class Analytics {
    private Integer id;
    private String experience;  // Interaction quality
    private LocalDate date;     // Interaction date
    private Double hours;       // Duration of interaction
    private Friend friend;      // Associated friend
}
```

#### Connection Mapping
```java
@Entity
public class Connections {
    private Integer id;
    private String description;
    private Friend friend1;     // First friend in relationship
    private Friend friend2;     // Second friend in relationship
}
```

### Database Schema
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Hibernate/JPA with automatic schema generation
- **Connection Pool**: Managed by Spring Boot
- **Transactions**: Declarative transaction management with `@Transactional`

## 🎨 Frontend Architecture

### Technology Stack
- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with Google Fonts (Roboto)
- **Architecture**: Single Page Application with dynamic content loading
- **Communication**: Fetch API for REST calls

### Key Features
1. **Weekly Dashboard**: Shows friends to contact this week based on birthdays and planned interaction times
2. **Friend Management**: Add, edit, delete friends with comprehensive forms
3. **Knowledge Base**: Store and manage facts about each friend
4. **Analytics Dashboard**: Visualize communication patterns and statistics
5. **File Upload System**: Manage photos, videos, and documents per friend
6. **Calendar View**: Visual representation of upcoming interactions

### Page Structure
```
nginx/static/
├── index.html              # Main dashboard
├── addFriendForm/          # Friend creation interface
├── analytics/              # Statistics and charts
├── calendarView/           # Calendar interface
├── facts/                  # Knowledge management
├── fileUpload/             # Media upload system
├── mainPage/               # Dashboard styling
├── navigation/             # Navigation components
├── profile/                # Friend profile pages
└── updateForm/             # Friend editing interface
```

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Git
- 8GB+ RAM recommended
- Windows/Linux/MacOS

### Quick Start
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Communicator
   ```

2. **Environment Setup**:
   ```bash
   # Copy and modify environment variables if needed
   echo "HOST_TIMEZONE=UTC" > .env
   ```

3. **Start the system**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Main Application: http://localhost:8090
   - Friend Service API: http://localhost:8090/api/friend/
   - File Upload: http://localhost:8090/api/fileRepository/

### Development Setup
```bash
# Start individual services for development
docker-compose up postgres -d  # Database only
cd friend && mvn spring-boot:run  # Friend service
cd ../resourceRepository/flask-template && python app.py  # File service
```

## 📚 API Documentation

### Friend Service API

#### Core Endpoints
```http
GET    /allFriends           # Get all friends
GET    /thisWeek             # Get friends to contact this week
POST   /addFriend            # Create new friend
PUT    /talkedToFriend/{id}  # Update friend after interaction
DELETE /deleteFriend/{id}    # Remove friend

# Knowledge Management
POST   /addKnowledge/{id}    # Add facts about friend
PUT    /updateKnowledge      # Update existing knowledge
DELETE /deleteKnowledge/{id} # Remove knowledge

# Analytics
GET    /analyticsList        # Get interaction analytics
```

#### Request/Response Examples
```json
# POST /addFriend
{
  "name": "John Doe",
  "experience": "**",
  "dateOfBirth": "1990-05-15",
  "analytics": [
    {
      "experience": "**",
      "date": "2024-01-15",
      "hours": 2.5
    }
  ],
  "knowledge": [
    {
      "text": "Loves hiking and outdoor activities",
      "priority": 5
    }
  ]
}
```

### File Repository API
```http
POST /upload              # Upload files for a friend
POST /files               # Download files batch as ZIP
```

## 🔧 Configuration

### Docker Compose Services
```yaml
services:
  postgres:     # PostgreSQL with pgvector
  friend:       # Friend management service
  group:        # Group management service  
  connections:  # Relationship mapping service
  fileRepository: # Media storage service
  backup:       # Backup automation service
  nginx:        # API Gateway and web server
```

### Environment Variables
- `HOST_TIMEZONE`: System timezone (default: UTC)
- `POSTGRES_USER`: Database user (default: myapp_user)
- `POSTGRES_PASSWORD`: Database password (default: example)
- `POSTGRES_DB`: Database name (default: my_database)

### Port Mapping
- **8090**: NGINX (Main entry point)
- **5433**: PostgreSQL (External access)
- **8085**: Friend Service (Internal)
- **8086**: Group Service (Internal)
- **8088**: Connections Service (Internal)
- **5000**: File Repository (Internal)

## 🎯 Key Features

### 1. **Smart Scheduling System**
- Automatic meeting time calculation based on interaction quality
- Star rating system: "*" = daily, "**" = weekly, "***" = monthly
- Birthday reminder integration
- Weekly dashboard showing priority contacts

### 2. **Knowledge Management**
- Store important facts about each friend
- Priority-based organization
- Date tracking for knowledge entries
- Search and filter capabilities

### 3. **Analytics & Insights**
- Interaction frequency tracking
- Quality scoring over time
- Visual analytics dashboard
- Export capabilities for data analysis

### 4. **Media Integration**
- Photo, video, and voice recording storage
- Friend-specific organization
- Batch upload and download
- Secure file access controls

### 5. **Relationship Mapping**
- Track connections between friends
- Bidirectional relationship modeling
- Group membership management
- Social network visualization (planned)

## 🔄 Business Logic

### Meeting Time Calculation
```java
public LocalDate setMeetingTime(String stars, LocalDate date) {
    switch (stars) {
        case "*":   return date.plusDays(1);    // Daily contact
        case "**":  return date.plusWeeks(1);   // Weekly contact  
        case "***": return date.plusMonths(1);  // Monthly contact
        default:    return date.plusMonths(1);  // Default monthly
    }
}
```

### Weekly Friend Selection
The system automatically identifies friends to contact based on:
1. **Birthday Proximity**: Friends with birthdays in the current week
2. **Overdue Interactions**: Friends past their planned speaking time
3. **Priority Scoring**: Combination of relationship strength and recency

## 📈 Future Enhancements (From plan.txt)

### Phase 1: Architecture Improvements
- [ ] Enhanced NGINX load balancing
- [ ] HTTPS implementation with Let's Encrypt
- [ ] Service discovery and health checks
- [ ] Monitoring with Prometheus + Grafana

### Phase 2: UI/UX Redesign
- [ ] **Weekly Pane System**: 8-slot dashboard (7 daily + 1 missed)
- [ ] React/Vue.js frontend migration
- [ ] TailwindCSS styling system
- [ ] Mobile-responsive design

### Phase 3: Advanced Analytics
- [ ] **Dynamic Discount Rates**: Quality-based scoring (0.99/0.97/0.95)
- [ ] Interaction history visualization
- [ ] Predictive relationship maintenance
- [ ] Social network analysis

### Phase 4: DevOps & Production
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Container registry integration
- [ ] Production deployment automation
- [ ] Backup encryption and cloud storage

## 🛠️ Development Guidelines

### Code Structure
```
friend/src/main/java/communicate/
├── Controller/       # REST endpoints
├── Services/         # Business logic
├── Repository/       # Data access layer
├── Entities/         # JPA entities
├── DTOs/            # Data transfer objects
└── Main.java        # Application entry point
```

### Technology Stack
- **Backend**: Spring Boot 3.2.1, Java 21, Maven
- **Database**: PostgreSQL 17 with pgvector
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Infrastructure**: Docker, NGINX
- **File Storage**: Flask-based Python service

### Development Workflow
1. Database changes → Update entities
2. Business logic → Update services
3. API changes → Update controllers
4. Frontend → Update static files
5. Testing → Integration tests with Docker

## 📝 License & Contributing

This project appears to be a personal development system. For contribution guidelines and licensing information, please refer to the project maintainer.

## 🆘 Troubleshooting

### Common Issues
1. **Port Conflicts**: Ensure ports 8090, 5433 are available
2. **Docker Memory**: Increase Docker memory allocation to 8GB+
3. **Database Connection**: Check PostgreSQL container logs
4. **File Permissions**: Ensure proper volume mount permissions

### Health Checks
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Database connection test
docker exec -it postgresDB psql -U myapp_user -d my_database
```

## 📊 System Metrics

### Performance Characteristics
- **Startup Time**: ~30-60 seconds (all services)
- **Memory Usage**: ~2-4GB total (all containers)
- **Storage**: Minimal (database + file uploads)
- **Concurrent Users**: Designed for single-user/family use

### Scalability Considerations
- Microservices can be independently scaled
- Database can be clustered for higher availability
- File storage can be moved to cloud services
- NGINX can handle multiple upstream instances

---

*Last Updated: July 2025*
*Version: 1.0-SNAPSHOT*
