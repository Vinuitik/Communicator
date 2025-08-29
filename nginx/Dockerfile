# Multi-stage build for React frontend
FROM node:18-alpine AS react-builder

WORKDIR /app

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build the React application
ENV NODE_ENV=production
RUN npm run build

# Build the React application
ENV NODE_ENV=production
RUN npm run build

# Main nginx stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static content (existing pages)
COPY static/ /usr/share/nginx/html/

# Copy built React application
COPY --from=react-builder /app/dist/ /usr/share/nginx/html/react/

# Set proper permissions
RUN chmod 644 /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]