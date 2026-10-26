#!/bin/bash

echo "==> [ValidateService] Validating new application server is running..."
# verify we can access our webpage successfully
curl -v --silent localhost:3001 2>&1 | grep Architecting