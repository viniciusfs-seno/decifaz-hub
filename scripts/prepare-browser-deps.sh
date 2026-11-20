#!/usr/bin/env bash
set -euo pipefail
# GitHub images may route apt through Azure/EC2 mirror lists. Their package
# downloads can spend the job budget before browser assertions begin.
# Normalize only Ubuntu sources; keep third-party repositories unchanged.
for source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources /etc/apt/apt-mirrors.txt /etc/apt/apt-mirrors-security.txt; do
  if [ -f "$source" ]; then
    sudo sed -i -E \
      -e 's#mirror\+file:/etc/apt/apt-mirrors(-security)?\.txt#https://archive.ubuntu.com/ubuntu#g' \
      -e 's#https?://(azure\.archive\.ubuntu\.com|[^/]*\.ec2\.archive\.ubuntu\.com)/ubuntu/?#https://archive.ubuntu.com/ubuntu/#g' \
      "$source"
  fi
done
printf 'Acquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAcquire::Retries "2";\n' | sudo tee /etc/apt/apt.conf.d/99-hub-network >/dev/null
