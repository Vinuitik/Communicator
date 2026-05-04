# Stage 1: Build React app
FROM node:18-alpine AS react-build
WORKDIR /app
COPY react/package.json ./
RUN npm install
COPY react/ .
RUN npm run build

# Stage 2: Nginx serving both static vanilla JS and React build
FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/static/ /usr/share/nginx/html/
COPY --from=react-build /app/build /usr/share/nginx/react-app/
RUN chmod 644 /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
