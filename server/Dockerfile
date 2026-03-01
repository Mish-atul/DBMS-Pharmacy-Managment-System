# Dockerfile for the backend server
FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules (bcrypt, sqlite3)
RUN apk add --no-cache python3 make g++ 

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads/avatars uploads/prescriptions

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
