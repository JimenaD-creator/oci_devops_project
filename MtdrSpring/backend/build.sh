#!/bin/bash
set -e

export IMAGE_NAME=todolistapp-springboot
export IMAGE_VERSION=${IMAGE_VERSION:-$(git rev-parse --short HEAD)}

if [ -z "$DOCKER_REGISTRY" ]; then
    export DOCKER_REGISTRY=$(state_get DOCKER_REGISTRY)
    echo "DOCKER_REGISTRY set."
fi

if [ -z "$DOCKER_REGISTRY" ]; then
    echo "Error: DOCKER_REGISTRY env variable needs to be set!"
    exit 1
fi

export IMAGE=${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_VERSION}

echo "Building image: $IMAGE"

# Skip unit tests in CI image build (same as Dockerfile); run tests locally with: mvn test -Dspring.profiles.active=test
mvn clean package spring-boot:repackage -DskipTests -Dspring.profiles.active=test
docker build -f Dockerfile -t "$IMAGE" .

echo "Pushing image: $IMAGE"
docker push "$IMAGE"

docker rmi "$IMAGE" || true