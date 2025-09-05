# Stage 1: Build the application with dependency caching
FROM node:18 AS build
WORKDIR /app

# Copy only the package.json to leverage Docker's layer caching
COPY package.json ./

# Download all dependencies. This layer is cached as long as package.json doesn't change.
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the final, smaller image
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/build .
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]