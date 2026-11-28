#!/usr/bin/env bash
set -euo pipefail
# Only parser/configuration inspection. Never starts an SSH listener.
dpkg-query -W openssh-server
mkdir -p /run/sshd /tmp/fixture
ssh-keygen -q -t ed25519 -N '' -f /tmp/fixture/host_key
/usr/sbin/sshd -t -f /fixture/sshd_config.candidate -h /tmp/fixture/host_key
/usr/sbin/sshd -T -f /fixture/sshd_config.candidate -h /tmp/fixture/host_key | sed "s/[[:blank:]]*$//" > /tmp/effective-sshd
for expected in 'port 22' 'addressfamily inet' 'permitrootlogin no' 'passwordauthentication no' 'kbdinteractiveauthentication no' 'pubkeyauthentication yes' 'authenticationmethods publickey' 'permitemptypasswords no' 'strictmodes yes' 'allowusers ovranto-operator' 'usepam yes' 'disableforwarding yes' 'permittunnel no' 'x11forwarding no' 'permituserenvironment no' 'maxauthtries 3' 'maxsessions 4' 'logingracetime 30' 'loglevel VERBOSE' 'subsystem sftp internal-sftp'; do
  grep -Fxiq "$expected" /tmp/effective-sshd || { printf 'Missing effective SSH setting: %s\n' "$expected" >&2; exit 1; }
done
echo 'Ubuntu OpenSSH syntax and effective candidate policy PASS.'
