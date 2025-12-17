# Film Club Management App - Requirements Document

## Overview

A web application for managing weekly film club activities including film nominations, voting, and maintaining a watch history. Designed for self-deployment by individual clubs with minimal operational overhead and low cost.

## Core Functionality

### 1. Film Nomination
- Any club member can add films to the voting list at any time
- Films can only be added once to prevent duplicates
- Initial MVP stores film title only
- Films that don't win remain on the list for future weeks
- Films from the watch history can be re-nominated

### 2. Voting System
- **Algorithm**: Condorcet voting method
  - Members rank films on a scale of 0-3
  - Members can rank as many or as few films as they like
  - System calculates the "least bad choice" across all votes
  - Architecture must support easy swapping of voting algorithms
- **Tie-breaking**: Random selection among tied films
- **Visibility**: No real-time vote results; results revealed only after voting closes
- **Schedule**: Fully automated based on club configuration

### 3. Automated Scheduling
- Voting opens on a configurable day/time (default: Friday)
- Voting closes and winner is selected on a configurable day/time (default: Saturday)
- Each club configures their own timezone
- Each club configures their own voting window times

### 4. Watch History
- Simple chronological list of watched films
- Records film title and date watched
- No comments, reviews, or statistics in MVP

## User Management

### Authentication
- Simple password-based authentication
- Single club password set by the instance creator
- All members use the same password to access the club

### Permissions
- Equal permissions for all members
- No admin/moderator roles
- All members can:
  - Add films to the voting list
  - Vote on films
  - View the watch history

### Scale
- Current target: 30 members per club
- Design target: Up to 1,000 members per club
- Must support multiple independent club instances

## Multi-Club Architecture

### Deployment Model
- Each club deploys their own independent instance
- No multi-tenant architecture required
- Clubs are isolated from each other
- No inter-club discovery or communication

### Limits
- No hard limits on members, films, or history in MVP
- System should gracefully handle growth

## Technical Requirements

### Infrastructure
- **Cloud Provider**: Google Cloud Platform (GCP) preferred
- **Compute**: Serverless architecture (Cloud Functions or similar)
- **Database**: More robust than Google Sheets, but simple to maintain
  - Candidates: Firestore, Cloud SQL (PostgreSQL), or similar managed service
- **Hosting**: Cloud-native with autoscaling
- **Cost Priority**: Low cost and minimal operational overhead over performance

### Frontend
- Web application only (no native mobile apps)
- Mobile-first responsive design
- Framework with good out-of-box UI/UX
  - Candidates: Tailwind CSS, Material UI, or similar
- Works well on mobile browsers

### Backend
- Serverless functions for API endpoints
- Scheduled functions for automated voting window management
- Voting algorithm should be modular/pluggable

## Future Enhancements (Out of Scope for MVP)

### Film Database Integration
- Integration with TMDB or IMDB API
- Auto-populate film metadata (year, genre, runtime, poster)
- Where-to-watch information

### Enhanced Features
- User comments/reviews on watched films
- Statistics and analytics
- User profiles with vote history
- Admin/moderator roles
- More sophisticated authentication (email/password, social login)
- Film discovery and recommendations

## Success Criteria

### MVP Must Support
1. 30-member club running smoothly
2. Weekly nomination and voting cycle
3. Automated scheduling without manual intervention
4. Simple deployment process for new clubs
5. Near-zero operational overhead
6. Cost under $5/month for typical 30-member club

### MVP Does NOT Need
- Real-time updates
- Push notifications
- Email notifications
- User registration flows
- Password recovery
- Film metadata beyond title
- Analytics or reporting
- Export functionality

## Key Constraints

1. **Simplicity**: Prefer simple solutions over complex ones
2. **Cost**: Minimize ongoing operational costs
3. **Maintenance**: Minimal manual intervention required
4. **Self-service**: Clubs can deploy and manage their own instance
5. **Scalability**: Must handle growth from 30 to 1,000 members gracefully
