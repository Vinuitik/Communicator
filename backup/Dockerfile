# Stage 1: Build the Spring Boot app with Maven dependency caching
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies: only re-download when pom.xml changes
COPY pom.xml .
RUN mvn dependency:go-offline

COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Slim runtime + postgresql-client-17 for pg_dump / pg_restore
# (server is pgvector/pgvector:pg17 — the client major MUST be >= the server major)
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget gnupg ca-certificates && \
    echo "deb http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-17 && \
    apt-get purge -y wget gnupg && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/BackupService.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
