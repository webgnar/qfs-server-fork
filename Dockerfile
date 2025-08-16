# Use Node.js official image
FROM node:20.10.0-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose port (Railway will map this correctly)
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]