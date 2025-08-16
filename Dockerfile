# Use Node.js official image
FROM node:20.10.0-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port 8080 (Railway's expected port)
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]