#!/bin/sh
set -e
mkdir -p /etc/nginx/certs
if [ ! -s /etc/nginx/certs/dev.crt ] || [ ! -s /etc/nginx/certs/dev.key ]; then
  echo "pawfinds-proxy: generating self-signed TLS cert (dev only)..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/dev.key \
    -out /etc/nginx/certs/dev.crt \
    -config /etc/nginx/ssl/openssl-san.cnf
  chmod 644 /etc/nginx/certs/dev.crt
  chmod 600 /etc/nginx/certs/dev.key
fi
