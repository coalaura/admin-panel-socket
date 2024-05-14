![banner](.github/banner.png)

## Overview

OP-FW Socket is a Node.js application designed to integrate with the [OP-FW Admin](https://github.com/coalaura/opfw-admin) panel, enhancing its functionality by providing real-time data and interaction capabilities. This backend service plays a crucial role in managing and broadcasting the live positional data of players within the OP-FW framework, a custom solution tailored for OP-FW FiveM servers. It basically acts as a proxy between the OP-FW Admin panel and the OP-FW API on the FiveM server(s).

## Requirements
- [nodejs](https://nodejs.org/en/download) 18.0.0 or higher
- At least 2GB of memory (or swap)
- A decent bit of space depending on how many servers (for historic data)

## Configuration
Create a file in the root of the directory called `_config.json`. This is how it should look like (configure to your environment):

```json
{
    "panel": "/path/to/opfw-admin",
    "servers": [
        "c1", "c2"
    ],
    "twitch": {
        "api": "https://op-framework.com/api/twitch/streamer/%s",
        "streamers": [
            "inzidiuz",
            "coalaura",
            "northbayjoe"
        ]
    }
}
```

## Swap Space Configuration
```bash
# Check if you already have swap space
swapon --show

# Allocate 8G of swap space
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persist swap space
# Add this to the bottom of the file
# /swapfile none swap sw 0 0
nano /etc/fstab
```

## Logrotate Configuration
```bash
nano /etc/logrotate.d/panel_socket
```

```
/var/log/panel_socket.log {
    daily
    missingok
    rotate 180
    compress
    delaycompress
    notifempty
}
```