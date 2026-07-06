# Giai đoạn 1: Dựng môi trường "nháp" để tạo cấu hình

Đầu tiên, bạn cần một môi trường ở máy local của bạn để tạo dữ liệu. Hãy tạo một file `docker-compose.yml` như sau. 

Lưu ý tôi đã mount một volume có tên `./export` để lát nữa hứng dữ liệu xuất ra.

```yaml
version: '3.8'
services:
  keycloak-mysql:
    container_name: keycloak-mysql
    image: mysql:8.3.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: keycloak
      MYSQL_USER: keycloak
      MYSQL_PASSWORD: password

  keycloak:
    container_name: keycloak
    image: quay.io/keycloak/keycloak:24.0.1
    command: ["start-dev"]
    environment:
      KC_DB: mysql
      KC_DB_URL: jdbc:mysql://keycloak-mysql:3306/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: password
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8181:8080"
    volumes:
      # Volume này dùng để xuất cấu hình ra ngoài máy của bạn
      - ./export:/opt/keycloak/data/export
    depends_on:
      - keycloak-mysql
```

Chạy lệnh `docker-compose up -d` để khởi động. 

Sau đó, bạn vào http://localhost:8181 đăng nhập bằng `admin/admin` và bắt đầu tạo Realm, Clients, Users theo ý muốn của dự án.

# Giai đoạn 2: Xuất dữ liệu (Export Realm)

Sau khi bạn đã cấu hình xong mọi thứ trên giao diện, bạn cần xuất toàn bộ dữ liệu đó ra thành file JSON.

Chạy lệnh sau ngay trên terminal của máy bạn (trong lúc container đang chạy):

```bash
docker exec -it keycloak /opt/keycloak/bin/kc.sh export --dir /opt/keycloak/data/export
```

Lệnh này sẽ tạo ra một hoặc nhiều file `.json` (ví dụ: `your-realm.json`) nằm trong thư mục `./export` trên máy local của bạn. 

Đây chính là "tài sản" quan trọng nhất. Sau bước này, bạn có thể chạy `docker-compose down -v` để xóa sạch môi trường nháp này đi.

# Giai đoạn 3: Đóng gói thành Docker Image để chia sẻ

Bây giờ bạn sẽ tạo một Dockerfile cho Keycloak để gói file `.json` vừa xuất được vào bên trong. Bạn không cần tạo Dockerfile cho MySQL nữa, cứ dùng image gốc của MySQL là được.

Tạo file Dockerfile (nằm cùng cấp với thư mục `./export`):

```Dockerfile
# Sử dụng base image của Keycloak
FROM quay.io/keycloak/keycloak:24.0.1

# Copy toàn bộ file cấu hình JSON bạn vừa xuất vào thư mục import của Keycloak
COPY ./export/ /opt/keycloak/data/import/

# Khi container khởi chạy, nó sẽ tự động import các file JSON này vào Database
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--import-realm"]
```

## Build và đẩy lên Docker Hub:

```bash
docker build -t ten_tai_khoan_cua_ban/my-custom-keycloak:v1 .
docker push ten_tai_khoan_cua_ban/my-custom-keycloak:v1
```

## Thành quả cho các thành viên khác
Bây giờ, các thành viên khác trong team của bạn chỉ cần tạo một file docker-compose.yml cực kỳ gọn gàng như sau là có thể chạy ngay lập tức, với đầy đủ Realm, Client và User bạn đã tạo:

```yaml
version: '3.8'
services:
  keycloak-mysql:
    container_name: keycloak-mysql
    image: mysql:8.3.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: keycloak
      MYSQL_USER: keycloak
      MYSQL_PASSWORD: password

  keycloak:
    container_name: keycloak
    # Sử dụng image bạn vừa push lên
    image: ten_tai_khoan_cua_ban/my-custom-keycloak:v1
    environment:
      KC_DB: mysql
      KC_DB_URL: jdbc:mysql://keycloak-mysql:3306/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: password
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8181:8080"
    depends_on:
      - keycloak-mysql
```



