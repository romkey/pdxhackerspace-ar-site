FROM nginx:1.27-alpine

# `envsubst` (from gettext) is used by the nginx image's template hook
# and by our entrypoint hook below. `nodejs` runs the printer backend
# proxy that talks to Home Assistant.
RUN apk add --no-cache gettext nodejs

COPY public /usr/share/nginx/html
COPY markers /usr/share/nginx/html/markers
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY server /app
# Source path `entrypoint.d/` lives in this repo; the destination path
# `/docker-entrypoint.d/` is where the nginx base image looks for hooks.
COPY entrypoint.d/19-render-config.envsh /docker-entrypoint.d/19-render-config.envsh
COPY entrypoint.d/30-start-backend.sh /docker-entrypoint.d/30-start-backend.sh
RUN chmod +x /docker-entrypoint.d/19-render-config.envsh \
             /docker-entrypoint.d/30-start-backend.sh

# Only substitute our own env vars in the nginx template, so nginx
# variables like $uri and $proxy_host are left untouched.
ENV NGINX_ENVSUBST_FILTER=^CALENDAR_

EXPOSE 80
