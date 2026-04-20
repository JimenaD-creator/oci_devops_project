# MtdrSpring layout

```
MtdrSpring/
  backend/                    ← Spring Boot (`pom.xml`), React under `src/main/frontend/`
```

Maven runs `npm install` and `npm run build` from `backend/src/main/frontend` during `mvn package` (`frontend-src-dir` in `backend/pom.xml`).

### Build the full JAR (backend + React)

```bash
cd backend
mvn clean package
```

### Docker image

```bash
cd backend
docker build -f Dockerfile .
```
