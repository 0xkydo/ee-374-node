# Marabu Node in EC2

## Instance spec requirement

OS: Canonical, Ubuntu, 22.04 LTS, amd64 jammy image build on 2022-12-06
CPU > 1
Memory > 1GB

## Install npm and nodejs
1. Update: `sudo apt update`
2. Nodejs: `sudo apt install nodejs`
3. npm: `sudo apt install npm`

## Establish connection to repo
1. Generate RSA keypair: ``ssh-keygen -t rsa -C "comments"`` 
2. Press enter for all options.
3. Start ssh-agent: ``eval `ssh-agent -s` ``
4. Add to identity: ``ssh-add ~/.ssh/id_rsa``
5. Copy public key from ``cat ~/.ssh/id_rsa.pub``
6. Paste public key to deploy key inside repo setting.
7. Clone repo: ``git clone git@github.com:0xkydo/ee-374-node.git``
8. Enter repo: `cd ee-374-node`

## Install dependencies
`npm install`

## Setup systemctl for node
Systemctl allows running the node in background.
### Node setup
1. Move service file to correct folder. `sudo mv -f systemctl/marabu_node_start.service /lib/systemd/system`
2. Refresh systemd `sudo systemctl daemon-reload`
3. Start node `sudo systemctl start marabu_node_start`
4. Stop the node `sudo systemctl stop marabu_node_start`
5. Start node on startup `sudo systemtl enable marabu_node_start`

### Monitor node logs
1. Check status of the node `sudo systemctl status marabu_node_start`
2. Live follow the status of the node `journalctl --unit=marabu_node_start -f`

### Monitoring node setup
1. Move service file to correct folder. `sudo mv -f systemctl/marabu_node_monitor.service /lib/systemd/system`
2. Refresh systemd `sudo systemctl daemon-reload`
3. Start node `sudo systemctl start marabu_node_monitor`
4. Stop the node `sudo systemctl stop marabu_node_monitor`
5. Start node on startup `sudo systemtl enable marabu_node_monitor`
