FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY static/ /usr/share/nginx/html/

RUN chmod 644 /etc/nginx/nginx.conf