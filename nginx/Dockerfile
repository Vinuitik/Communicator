# Multi-stage build for React components
FROM node:18-alpine AS react-builder

WORKDIR /app
# copy package files and install (will include devDependencies for build tools)
# COPY react-components/package*.json ./
# COPY react-components/package-lock*.json ./
# RUN npm install

# copy source and build with NODE_ENV=production so MiniCssExtractPlugin is used
#COPY react-components/ ./
#ENV NODE_ENV=production
#RUN npm run build

# Main nginx stage
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY static/ /usr/share/nginx/html/
#COPY --from=react-builder /app/dist/ /usr/share/nginx/html/react/

RUN chmod 644 /etc/nginx/nginx.conf