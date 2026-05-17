#!/bin/bash

docker pull ghcr.io/zaproxy/zaproxy:stable

docker run -v ${PWD}:/zap/wrk/:rw -t \
  ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -cmd \
  -quickurl http://163.192.142.68 \
  -quickout /zap/wrk/result.xml