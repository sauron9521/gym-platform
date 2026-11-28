mock_provider "hcloud" {
  mock_resource "hcloud_firewall" {
    defaults = { id = "456" }
  }
}
variables {
  environment = "staging"
  location    = "nbg1"
  server_type = "cx33"
  ssh_key_ids = ["123"]
}
run "staging_candidate" {
  command = plan
  assert {
    condition     = hcloud_server.host.name == "ovranto-staging" && hcloud_server.host.server_type == "cx33"
    error_message = "Staging identity or size is wrong."
  }
  assert {
    condition     = hcloud_server.host.delete_protection && hcloud_server.host.rebuild_protection && !hcloud_server.host.backups
    error_message = "Protection or optional backup default is wrong."
  }
  assert {
    condition     = length(hcloud_firewall.host.rule) == 0 && hcloud_firewall.host.labels.environment == "staging"
    error_message = "Firewall must deny inbound by default and be environment-scoped."
  }
  assert {
    condition     = one(hcloud_server.host.public_net).ipv4_enabled && !one(hcloud_server.host.public_net).ipv6_enabled
    error_message = "Unexpected public network settings."
  }
}
run "production_candidate" {
  command = plan
  variables {
    environment = "production"
    location    = "fsn1"
    server_type = "cx43"
  }
  assert {
    condition     = hcloud_server.host.name == "ovranto-production" && hcloud_server.host.location == "fsn1" && hcloud_server.host.server_type == "cx43" && hcloud_firewall.host.labels.environment == "production"
    error_message = "Production candidate does not match the isolated German topology."
  }
}
run "reject_other_region" {
  command = plan
  variables {
    location = "hel1"
  }
  expect_failures = [var.location]
}
run "reject_missing_key" {
  command = plan
  variables {
    ssh_key_ids = []
  }
  expect_failures = [hcloud_server.host]
}
run "reject_wrong_size" {
  command = plan
  variables {
    environment = "production"
  }
  expect_failures = [hcloud_server.host]
}

run "allow_only_explicit_operator_ssh" {
  command = plan
  variables {
    operator_ipv4_cidrs = ["192.0.2.10/32", "198.51.100.20/32"]
  }
  assert {
    condition     = length(hcloud_firewall.host.rule) == 1 && one(hcloud_firewall.host.rule).direction == "in" && one(hcloud_firewall.host.rule).protocol == "tcp" && one(hcloud_firewall.host.rule).port == "22" && toset(one(hcloud_firewall.host.rule).source_ips) == toset(["192.0.2.10/32", "198.51.100.20/32"])
    error_message = "Only the exact synthetic operator SSH addresses may be allowed."
  }
}
run "reject_world_ssh" {
  command = plan
  variables {
    operator_ipv4_cidrs = ["0.0.0.0/0"]
  }
  expect_failures = [var.operator_ipv4_cidrs]
}
run "reject_subnet_ssh" {
  command = plan
  variables {
    operator_ipv4_cidrs = ["192.0.2.0/24"]
  }
  expect_failures = [var.operator_ipv4_cidrs]
}
run "reject_ipv6_ssh" {
  command = plan
  variables {
    operator_ipv4_cidrs = ["2001:db8::1/128"]
  }
  expect_failures = [var.operator_ipv4_cidrs]
}
run "reject_invalid_ipv4_ssh" {
  command = plan
  variables {
    operator_ipv4_cidrs = ["999.0.0.1/32"]
  }
  expect_failures = [var.operator_ipv4_cidrs]
}
