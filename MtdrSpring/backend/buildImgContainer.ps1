docker stop agilecontainer
docker rm -f agilecontainer
docker rmi agileimage
mvn clean verify
docker build -f DockerfileDev --platform linux/amd64 -t agileimage:0.1 .
docker run --name agilecontainer -p 8080:8080 --env-file .env -v "${PWD}/wallet:/app/wallet" -d agileimage:0.1
