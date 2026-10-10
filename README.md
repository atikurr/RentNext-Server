# RentNest — Backend API

A backend API for **RentNest**, a property rental and booking platform that connects property owners with tenants. The server manages application data, authentication, property listings, booking-related operations, and dashboard functionality.

## Project Overview

RentNest is designed to simplify the property rental process by allowing property owners to manage rental listings and tenants to explore properties and manage their bookings.

The backend provides server-side logic, database connectivity, API endpoints, and authentication support for the RentNest frontend.

## Features

- RESTful API built with Node.js and Express.js
- MongoDB database integration
- User authentication and authorization
- Role-based access for Admin, Owner, and Tenant
- Property listing management
- Property creation, updating, and deletion
- Booking and rental management
- Owner dashboard analytics
- Error handling and request validation
- Environment-based configuration
- Cross-Origin Resource Sharing (CORS) configuration

> Features should match the functionality implemented in the current backend.

## Technology Stack

- **Runtime:** Node.js
- **Backend Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Authentication:** Project-configured authentication system
- **Environment Variables:** dotenv
- **API Architecture:** REST API

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js
- npm
- MongoDB database or a MongoDB Atlas account
- Git

### Installation

Clone the backend repository:

```bash
git clone YOUR_BACKEND_GITHUB_REPOSITORY_URL
```

Navigate to the backend directory:

```bash
cd YOUR_BACKEND_FOLDER
```

Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env` file in the backend root directory and configure the environment variables required by your project.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**Important:** Use the exact variable names expected by your source code. If the application uses Better Auth or another authentication configuration, configure its required environment variables instead of adding unused JWT variables.

Never commit `.env` files, database credentials, API keys, or secrets to GitHub.

### Run the Server

Start the backend using the command defined in your `package.json`.

Common examples:

```bash
npm run dev
```

Or, if the project uses a standard start script:

```bash
npm start
```

The server should start on the configured port. For example:

```text
Property Rental Server running on port 5000
MongoDB connected successfully
```

The actual terminal output depends on your server configuration.

## API Documentation

The backend exposes API endpoints for the application's supported features.

Typical API modules may include:

| Module | Purpose |
|---|---|
| Authentication | User authentication and account access |
| Users | User profile and account management |
| Properties | Property listing management |
| Bookings | Rental booking operations |
| Owner Dashboard | Property statistics and earnings |
| Admin | Administrative operations |

The exact routes, HTTP methods, request parameters, and response formats should be documented according to the implemented Express routes.

### API Base URL

Local development:

```text
http://localhost:5000
```

Production:

```text
YOUR_DEPLOYED_BACKEND_URL
```

## Database

RentNest uses MongoDB to store application data. Mongoose can be used to define schemas, validate documents, and interact with the database.

Configure the MongoDB connection string through environment variables. Ensure the database credentials and network access settings are configured correctly.

## Frontend Integration

The backend is designed to communicate with the RentNest frontend.

**Frontend URL:** https://rent-next-client.vercel.app/

Configure CORS to allow requests from the deployed frontend and any required local development origin.

## Deployment

To deploy the backend:

1. Push the backend source code to GitHub.
2. Create a web service on a supported hosting platform.
3. Configure the required environment variables.
4. Set the build and start commands according to `package.json`.
5. Verify the MongoDB connection.
6. Update the frontend API base URL to the deployed backend URL.
7. Test authentication, property operations, and booking-related endpoints.

Do not expose secret environment variables in public documentation.

## Security Considerations

- Keep database credentials and authentication secrets private.
- Validate incoming request data.
- Apply authentication and authorization to protected routes.
- Restrict CORS to trusted origins.
- Handle errors without exposing sensitive server information.
- Protect administrative operations with appropriate authorization.

## Repository Information

- **Project:** RentNest
- **Project Type:** Property Rental & Booking Platform
- **Repository:** Backend API
- **Frontend:** https://rent-next-client.vercel.app/

## License

This project was developed for academic assignment purposes. Add a formal license if required.