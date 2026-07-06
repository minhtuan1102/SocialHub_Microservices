# Sử dụng base image của Keycloak
FROM quay.io/keycloak/keycloak:24.0.1

# Copy toàn bộ file cấu hình JSON bạn vừa xuất vào thư mục import của Keycloak
COPY ./export/ /opt/keycloak/data/import/

# Khi container khởi chạy, nó sẽ tự động import các file JSON này vào Database
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--import-realm"]
