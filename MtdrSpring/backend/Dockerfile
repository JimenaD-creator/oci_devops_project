FROM maven:3.9.6-eclipse-temurin-22 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM openjdk:22-jdk
WORKDIR /tmp/
COPY --from=build /app/target/MyTodoList-0.0.1-SNAPSHOT.jar MyTodoList.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "MyTodoList.jar"]