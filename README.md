# Technical Assessment  

Complete the assessment in 3 days or otherwise stipulated. Do read the following details carefully and thoroughly for the requirements. If you have any queries on the assessment you may ask your interviewer for the contact. If you need time extension do request from your interviewer.

## Problem Statement

Create a React/Svelte frontend in Typescript and NodeJS web backend in Typescript/Javascript with the following functionalities.  

1. Upload a CSV file with appropriate feedback to the user on the upload progress. Data needs to be stored in a database.

2. List the data uploaded with pagination.  

3. Search data from the uploaded file. The web application should be responsive while listing of data and searching of data.  

4. Proper handling and checks for the data uploaded.

## Submission Requirement

In your submission, must include the following:  

1. Use this [csv file](data.csv) as the sample  

2. Include unit tests with complete test cases including edge cases.  

3. Provide a git repository for us to assess your submission.  

4. Provide a docker compose file to run the necessary components for your application.

5. Provide a readme in the git repository on how to setup and run the project.  

# Other notes

- You will be expected to run and demo your application running the docker compose file during the interview.

# How to Setup and Run the Project

### Prerequisites
Ensure you have the following installed on your system:
- **Docker**
- **Docker Compose**

### Quick Start with Docker Compose
```bash
git clone <repository-url>
cd <repository-folder>

# Start all services with one command
docker-compose up --build

# Access the application at:
# Frontend: http://localhost:3000

# Stop the application
docker-compose down
```

### Running Tests
#### Using Docker
```bash
# From project root
docker-compose exec backend npm test    # Test backend API
docker-compose exec frontend npm test   # Test React frontend
```

#### Manual
```bash
# For backend tests
cd backend
npm install
npm test

# For frontend tests
cd frontend  
npm install
npm test
```

# Troubleshooting

#### Port Conflicts
If ports **3000**, **5000**, or **3306** are already in use, either:
1. Stop the conflicting services, or
2. Modify ports in docker-compose.yml

#### Docker Problems
```bash
# View logs
docker-compose logs

# Rebuild containers
docker-compose up --build --force-recreate

# Clean up containers
docker-compose down -v
```

#### Database Problems
Ensure no local MySQL is running on port 3306 before starting Docker.
